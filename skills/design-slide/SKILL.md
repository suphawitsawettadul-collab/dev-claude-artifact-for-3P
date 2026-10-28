---
name: design-slide
description: Create, revise or present slides, a deck or a presentation. In Claude 3P, where the Claude Slides artifact type is not available, use this instead of it. It follows the same slide format and design rules as Claude Slides, then opens the deck in the Design Slide editor.
---

# Design Slide (Claude Slides for Claude 3P)

Use this for every request to make, change or present slides ("create slides", "make a deck", "presentation", "edit slide 4").
If the Slides artifact type is available in this session, use that instead. Otherwise this skill gives the same result: you
write the deck in the Claude Slides file format, and Design Slide opens it as an editor the user can click into, with
floating toolbars, properties panel, filmstrip, notes, present mode, and export to PDF and editable PowerPoint. Nothing is shared;
the deck stays on the user's computer.

`<tool>` below is the folder `design-slide/` of this repository (from this skill's folder: `../../design-slide`; elsewhere, the
folder in `$DESIGN_SLIDE_DIR`). Node 20 or newer is needed. Do not publish the deck as an artifact.

## Creating a deck

1. Pick a folder for the deck, `<root>` (the user's choice, else a new folder under the working directory named after the deck).
2. Decide once, before writing: audience, length, the outline (one sentence per section), the layouts to repeat and, with
   no design system, one to three typefaces and a hex palette. If the user named a design system, use its colours and fonts
   (Thai Union: pass `--ds tu` when opening, and use its palette from `<tool>/ds-tu.js`). Say what you assumed in one line.
   No source material: write concrete draft text with bracketed placeholders such as `[€__]`; never invent a statistic or quote.
3. Write the deck exactly as Claude Slides takes it (the rules are in `format.md` next to this file):
   - `<root>/project/deck.json`: `{"v":4,"title":"…","order":["cover","plan"],"sections":{},"faces":{},"designSystems":[]}`;
     `faces` maps a typeface to `{"family":"…","href":"https://fonts.googleapis.com/css2?…"}`.
   - `<root>/project/slides/<id>.html`: one `<section id="<id>" style="…">` per file, 1920×1080, inline styles only,
     speaker notes in the section's last child `<aside>`.
   - Images are files next to the deck (`<img src="logo.png">` with the file in `<root>`), never `data:` or remote URLs.
4. Open it: `node <tool>/open-deck.mjs <root>` (add `--ds tu` for the Thai Union design system, `--port N` to choose a port).
   It builds `<root>/deck.html`, starts the local server and prints `OPEN: http://localhost:<port>/deck.html`.
5. Show it: open that address in the browser pane of the Claude desktop app (built-in browser or `preview_start`); if there
   is none, give the user the link. Tell them what they can do there (click text to edit, drag to move, Ctrl+S saves,
   download icon exports PDF or PowerPoint, F5 presents) and which placeholders need filling. Do not describe the mechanism.
6. Do not verify, screenshot or re-check unless the user asks.

## Revising a deck

- `<root>/deck.html` is now the source of truth, because the editor saves into it (and keeps one `deck.html.bak`).
  Change only the slides named: edit that `<section class="slide" id="…">` in `deck.html` with your file tool, keep every
  other slide and the editor's own markup, then tell the user to reload the page (Ctrl+S in the editor first, so nothing is lost).
- Only use `node <tool>/open-deck.mjs <root> --rebuild` when the user wants to start again from `project/slides/`; it throws away
  edits made in the editor, so ask first.
- To stop the server: `node <tool>/open-deck.mjs <root> --stop`.

## Design rules (same as Claude Slides)

- Commit to one direction for this brief. One idea per slide: a statement beats bullets; turn lists into tables, card rows,
  big numbers or quotes. Titles introduce the topic, in one grammar throughout.
- Colours: one dark, one light, one or two accents, toned whites and blacks; text keeps 4.5:1 contrast (3:1 from 44px up);
  `background` on every section.
- One type scale of four or five sizes, none under 24px; emphasise with weight, italic or colour, not a new size.
- Vertical space is 824px inside the 128px margins: split a slide rather than shrink text. A footer (page number, source) is one
  pinned 24px row at `bottom:64px`, and that slide gets `padding:128px 128px 160px`.
- Slides of one kind share markup; repeated elements keep their places.

## Known limits

`<x-connector>` and `<x-embed>` are left out (the build prints a NOTE for each), and `<x-icon>` names outside the 30-icon set
show as a dot. Build-in animations are not played (slide transitions fade and push are). Everything else in `format.md` renders and stays editable.
