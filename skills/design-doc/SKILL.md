---
name: design-doc
description: Create, revise or review a document (doc, report, proposal, memo, spec, notes) that the user will keep editing, ONLY when Claude runs in 3P mode (third-party provider such as Bedrock, Vertex, Foundry or an LLM gateway) where Claude Docs is unavailable. Never use it when Claude Docs or other first-party artifact tools are available. Opens the doc in the local Design Doc editor.
allowed-tools: Bash(node *detect-3p.mjs* gate)
---

## Gate: 3P mode only

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-3p.mjs" gate`

If the line above says OFF, stop here and ignore the rest of this file. These tools exist only for Claude 3P mode and must never replace Claude Slides or Claude Docs.

# Design Doc (Claude Docs for Claude 3P)

Use this for every request to write or change a document the user will edit, comment on or send ("write a doc", "draft a proposal",
"add a section", "answer the comments"). If Claude Docs tools are available in this session, use those instead. Otherwise this skill
gives the same result: you write the doc as Markdown, Design Doc opens it as an editor with tabs, floating text toolbar, `/` block menu,
tables, checklists, images, charts, flow diagrams, comment threads, version history and export to Word, PDF and Markdown. Nothing is
shared; the doc stays on the user's computer. Do not publish it as an artifact.

`<tool>` below is the folder `design-doc/` of this repository (from this skill's folder: `../../design-doc`; elsewhere, the folder in
`$DESIGN_DOC_DIR`). Node 20 or newer is needed.

## Creating a doc

1. Pick a folder `<root>` (the user's choice, else a new folder named after the doc). Say in one line what you assumed (audience, length).
2. Write `<root>/doc.md`. Facts only from the user or their sources; use `[pending: what goes here]` on its own line for anything you
   cannot write yet, never invent a number or quote.
   - `# Title`, `##`, `###`, paragraphs, `**bold**`, `*italic*`, `` `code` ``, links, `-` lists (nest with two spaces), `1.` lists,
     `- [ ]` task lists, `>` quotes, tables, fenced code, `---`.
   - Tabs: a line `<!-- tab: Name -->` starts a tab, `<!-- subtab: Name -->` a sub-tab of the last tab. The main tab answers the ask by
     itself; add a second tab only for material a reader opens separately (sources, full data). Many tabs of one kind: an overview tab first.
   - A chart from 5+ values: a fence ```` ```chart ```` holding `{"type":"bar","title":"…","rows":[["label",12],…]}` (types: bar, line, pie).
   - A flow or timeline: a fence ```` ```diagram ```` holding `{"title":"…","steps":["A","B","C"]}`.
   - Images are not supported from Markdown; the user adds them in the editor.
3. Open it: `node <tool>/open-doc.mjs <root> --ds tu` (Thai Union look, the default for Thai Union work; leave `--ds` out for plain),
   plus `--byline "<user name>"` if known. It builds `<root>/doc.html`, starts the local server, prints `OPEN: http://localhost:<port>/doc.html`.
4. Show it in the browser pane of the Claude desktop app (built-in browser or `preview_start`); if there is none, give the user the link.
   Tell them what they can do: type in place, select text for the toolbar, `/` for blocks, comment (💬), Ctrl+S saves, History, Export.
   Do not describe the mechanism. Do not screenshot or re-check unless asked.

## Revising a doc

`<root>/doc.html` is the source of truth once opened, because the editor saves into it (and keeps one `doc.html.bak`). The page reloads
itself within two seconds of a change on disk, unless the user has unsaved edits, so you can fill a doc while they watch.
- Change only what was asked; every other word stays. Edit the `<section data-tab="…">` in `doc.html` with your file tool, keep the
  editor's markup (`data-tab`, `data-name`, `data-order`, `class="pending" data-intent`, figures with `data-chart` / `data-diagram`).
- To fill a pending block, replace `<div class="pending" data-intent="…"></div>` with the real blocks. Plant a pending block first for anything
  you will write only after researching it.
- Do not use `--rebuild` unless the user wants to start over from `doc.md`; it throws away edits made in the editor.
- Stop the server with `node <tool>/open-doc.mjs <root> --stop`.

## Comments

Threads live in the JSON block `<script type="application/json" id="doc-data">` at the end of `doc.html`: `comments: [{id, tab, quote,
by, ts, text, replies:[{by, ts, text}], resolved, to, answered}]`. The commented words are wrapped as `<span class="cm" data-cid="<id>">`.
- A thread with `"to":"claude"` and `"answered":false` asks you (someone wrote @Claude). Answer only those: push a reply
  `{"by":"Claude","ts":<Date.now()>,"text":"…"}`, set `"answered":true`, and make the change it asks for in the section if it asks for one.
- Never resolve a thread a person wrote in; never delete the `cm` spans. Leave threads that do not address you.

## Known limits

No real-time multi-person editing and no sharing (the doc is a local file; send the Word, PDF or Markdown export). Mermaid blocks are not
drawn (use a diagram fence). Comments sit on text, not on chart marks.
