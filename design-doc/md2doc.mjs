// Markdown -> Design Doc sections. Used by open-doc.mjs so Claude can write a doc as plain Markdown.
// Tabs: a line "<!-- tab: Name -->" starts a tab, "<!-- subtab: Name -->" a sub-tab of the last tab. Without markers there is one tab.
// Extras: ```chart {"type":"bar","title":"","rows":[["A",1]]}```  ```diagram {"title":"","steps":["A","B"]}```  "[pending: what will go here]" on its own line.
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = s => esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
function inline(t) {
  const codes = []; t = t.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  t = esc(t)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, a, u) => `<img src="${attr(u)}" alt="${attr(a)}">`)
    .replace(/\[([^\]]+)\]\(((?:https?:|mailto:|#)[^)\s]*)\)/g, (m, a, u) => `<a href="${attr(u)}">${a}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>').replace(/~~([^~]+)~~/g, '<s>$1</s>');
  return t.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${esc(codes[i])}</code>`);
}
function blocks(src) {
  const lines = src.replace(/\r/g, '').split('\n'), out = []; let i = 0;
  const isList = l => /^\s*([-*]|\d+\.)\s+/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = /^```(\w*)\s*(.*)$/.exec(l))) {
      const lang = m[1], rest = m[2]; const body = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]); i++;
      if (lang === 'chart' || lang === 'diagram') { const j = (rest + body.join('\n')).trim(); try { JSON.parse(j); out.push(`<figure class="${lang}" data-${lang}='${j.replace(/'/g, '&#39;')}'></figure>`); } catch { out.push(`<pre>${esc(j)}</pre>`); } }
      else out.push(`<pre>${esc(body.join('\n'))}</pre>`);
      continue;
    }
    if ((m = /^(#{1,3})\s+(.*)$/.exec(l))) { out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if ((m = /^\[pending:\s*(.*)\]\s*$/.exec(l))) { out.push(`<div class="pending" data-intent="${attr(m[1])}"></div>`); i++; continue; }
    if (/^>\s?/.test(l)) { const q = []; while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, '')); out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`); continue; }
    if (/^\|.*\|\s*$/.test(l) && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      const row = r => r.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
      const head = row(l); i += 2; const body = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) body.push(row(lines[i++]));
      out.push(`<table><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr>${body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</table>`);
      continue;
    }
    if (isList(l)) {
      const items = []; while (i < lines.length && isList(lines[i])) { const mm = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i++]); items.push({ d: Math.floor(mm[1].length / 2), o: /\d/.test(mm[2]), t: mm[3] }); }
      const task = items.every(x => /^\[[ xX]\]\s/.test(x.t));
      const walk = (k, d) => { let h = ''; const ordered = items[k].o; h += ordered ? '<ol>' : task ? '<ul class="check">' : '<ul>';
        while (k < items.length && items[k].d >= d) {
          if (items[k].d > d) { const [sub, nk] = walk(k, items[k].d); h = h.replace(/<\/li>$/, sub + '</li>'); k = nk; continue; }
          const t = items[k].t; const done = /^\[[xX]\]\s/.test(t); h += `<li${task && done ? ' data-done="1"' : ''}>${inline(task ? t.replace(/^\[[ xX]\]\s/, '') : t)}</li>`; k++;
        } return [h + (ordered ? '</ol>' : '</ul>'), k]; };
      let k = 0; while (k < items.length) { const [h, nk] = walk(k, items[k].d); out.push(h); k = nk; }
      continue;
    }
    const p = []; while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|>|\||\s*([-*]|\d+\.)\s|\[pending:)/.test(lines[i])) p.push(lines[i++]);
    if (!p.length) { p.push(lines[i++]); }
    out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  return out.join('\n');
}
export function mdToSections(md) {
  const parts = md.split(/^<!--\s*(sub)?tab:\s*(.*?)\s*-->\s*$/m); // [pre, sub, name, body, ...]
  const tabs = []; const pre = parts[0].trim();
  if (pre || parts.length === 1) tabs.push({ name: /^#\s+(.*)$/m.exec(pre)?.[1]?.replace(/[*`]/g, '') || 'Tab 1', body: pre, sub: false });
  for (let k = 1; k < parts.length; k += 3) tabs.push({ name: parts[k + 1], body: parts[k + 2], sub: !!parts[k] });
  let top = null, ti = 0, si = 0;
  return tabs.map((t, n) => {
    const id = 't' + (n + 1); let order, sub = '';
    if (t.sub && top) { sub = top; order = 'a' + String(si++).padStart(2, '0'); } else { top = id; si = 0; order = 'a' + String(ti++).padStart(2, '0'); }
    const h = /^\s*#\s/.test(t.body) ? '' : `<h1>${esc(t.name)}</h1>\n`;
    return `  <section data-tab="${id}" data-name="${attr(t.name)}" data-order="${order}"${sub ? ` data-subtab-of="${sub}"` : ''}>\n${h}${blocks(t.body)}\n  </section>`;
  }).join('\n');
}
export function docHtml({ title, byline = '', date = '', md, ds }) {
  return `<!doctype html>
<html lang="th"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design Doc: ${esc(title)}</title>
<link rel="stylesheet" href="editor.css">
${ds ? `<script src="ds-${ds}.js"></script>\n` : ''}</head>
<body>
<main id="doc" data-title="${attr(title)}"${byline ? ` data-byline="${attr(byline)}"` : ''}${date ? ` data-date="${attr(date)}"` : ''}>
${mdToSections(md)}
</main>
<script type="application/json" id="doc-data">{"comments":[],"revisions":[]}</script>
<script src="editor.js"></script>
</body></html>
`;
}
