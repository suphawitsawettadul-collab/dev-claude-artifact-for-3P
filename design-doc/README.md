# Design Doc

A local HTML document editor that stands in for Claude Docs when Claude runs in 3P mode: tabs, in-place editing, floating toolbar, `/`
block menu, tables, checklists, images, charts, flow diagrams, comment threads (with @Claude), version history, find and replace, and
export to Word, PDF, Markdown and HTML. Docs stay on your computer. Same structure as Design Slide (`../design-slide/`), same Thai Union
design system tokens (`ds-tu.js`).

- `editor.js`, `editor.css` — the editor. A doc is `doc.html`: sections of blocks plus one JSON block (comments, versions). Everything
  the editor adds is marked `data-chrome` or redrawn on load and stripped on save.
- `serve.mjs` — localhost server (`node serve.mjs [docFolder]`, port 4191). `POST /save` writes into the doc folder; `GET /stamp` lets the
  page reload when the file changes on disk.
- `open-doc.mjs`, `md2doc.mjs` — build `doc.html` from Markdown and open it (used by the skill).
- `design-doc-gap.md` — what Claude Docs does that this does or does not.
- `test/` — headless Chromium or Edge UI tests: `node design-doc/test/run-all.mjs`.

## Use it from Claude 3P ("create a document")

`skills/design-doc/` stands in for Claude Docs. Install: copy it to `~/.claude/skills/design-doc/` and set `DESIGN_DOC_DIR` to the full path
of this folder. Try it: `node design-doc/open-doc.mjs design-doc/examples/proposal --ds tu --byline "Your name"`.

## Run

```bash
node design-doc/serve.mjs design-doc      # then open http://localhost:4191/doc.html
```
