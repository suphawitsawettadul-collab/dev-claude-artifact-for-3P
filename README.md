# dev-claude-artifact-for-3P

Tools that stand in for claude.ai artifact types when Claude runs in 3P mode (where those types are not available).

## Design Slide

A local HTML slide deck editor that works like Claude Slides: edit text in place, select and move anything, floating
toolbars, design-system text styles and colours, filmstrip, grid view, present, and export to PDF or an editable PowerPoint
file. Decks stay on your computer; nothing is shared.

- `design-slide/` — the editor (`editor.js`, `editor.css`), the local server (`serve.mjs`), the Thai Union design system
  (`ds-tu.js` + `tu-bg-*.png`), two sample decks (`tu-test.html`, `deck.html`) and the gap list against Claude Slides
  (`design-slide-gap.md`).
- `design-slide/test/` — headless Edge UI tests (`node design-slide/test/run-all.mjs`).

### Run

```bash
node design-slide/serve.mjs
```

Then open http://localhost:4190/tu-test.html. To edit decks kept in another folder: `node design-slide/serve.mjs <deck folder>`.
The server listens on localhost only. A deck links `editor.css`, an optional design system (`ds-*.js`) and `editor.js`.

### Status

Groups A (selection, move, context menu, undo) and B (floating toolbars, colour picker) are done and tested.
Group C (properties panel, speaker notes under the slide) is work in progress and not tested yet.
Groups E, D and F are still to do — see `design-slide/design-slide-gap.md`.
