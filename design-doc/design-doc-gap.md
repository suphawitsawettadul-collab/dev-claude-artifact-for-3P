# Design Doc — gap list vs Claude Docs

Source: the Claude Docs tool guides (tabs, editing, comments, charts, diagram, uploads, sharing) read 2026-10-28. The Claude in Chrome
extension was not connected, so claude.ai was **not** walked through: pixel-level layout (spacing, icons, menu wording) is matched from
the guides and from what Claude Docs shows in screenshots users have shared, not measured. Have = Design Doc does it, with a test.

| # | Claude Docs | Design Doc |
|---|---|---|
| 1 | Doc = tabs, sub-tabs, order, rename, delete (min 1), tab tray | Have (t-tabs) |
| 2 | Headings, paragraphs, bullets, numbers, checklists, quote, code, rule | Have (t-edit, t-blocks) |
| 3 | Tables with row / column add and delete | Have: right-click menu, Tab adds a row (t-blocks) |
| 4 | Chips: date, mention, link to tab | Have (t-blocks) |
| 5 | Images (upload, paste) | Have: paste or `/image`, saved inside the file |
| 6 | Charts from rows, marks commentable | Have bar, line, pie from a data form. Marks carry `data-mark` but are not commentable |
| 7 | Diagrams (Mermaid, hand drawn SVG) | Have: flow of steps. Mermaid text is not drawn |
| 8 | Pending block filled while the user watches | Have: shimmer block, file reload within 2 s (t-save) |
| 9 | Floating toolbar, `/` menu, Markdown shortcuts, undo / redo | Have (t-edit) |
| 10 | Comment threads, reply, resolve, delete, @Claude flag | Have (t-comments). Comments are single-author; names come from the byline |
| 11 | Version history with restore | Have: a version per changed save, restore keeps the current state first (t-history) |
| 12 | Find and replace | Have (t-find) |
| 13 | Export Word, PDF, Markdown (open tab) | Have docx (valid zip, charts as pictures), Markdown, HTML (t-export). PDF uses the browser print dialog |
| 14 | Share (view / comment / edit), copy to Google Docs / Notion | Not applicable: local file. Replaced by export |
| 15 | Real-time editing by several people, guest access | Not built |
| 16 | Move a block by dragging | Alt+Up / Alt+Down only |
| 17 | Open edits from Claude without losing the user's work (rev check) | Have in effect: reload only when there are no unsaved edits, otherwise a warning |
