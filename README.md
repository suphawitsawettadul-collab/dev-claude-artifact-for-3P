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
- `docs/tasks/` — the job and its task pages.

### Use it from Claude 3P ("create slides")

`skills/design-slide/` is a skill that stands in for Claude Slides. Asked to create or change slides, Claude writes the deck in the
Claude Slides file format (`project/deck.json` and `project/slides/<id>.html`, rules in `skills/design-slide/format.md`, the same
design rules Claude Slides uses), then runs `node design-slide/open-deck.mjs <deck folder>`, which builds `deck.html`, starts the
local server and prints the address to open in the Claude desktop browser pane. The deck then opens in Design Slide, and
Ctrl+S saves edits into `deck.html`.

Install: copy `skills/design-slide/` to `~/.claude/skills/design-slide/` (or the project's `.claude/skills/`) and set
`DESIGN_SLIDE_DIR` to the full path of this repo's `design-slide/` folder. Try it with the sample deck:
`node design-slide/open-deck.mjs design-slide/examples/slides-format`.

### Run

```bash
node design-slide/serve.mjs
```

Then open http://localhost:4190/tu-test.html. To edit decks kept in another folder: `node design-slide/serve.mjs <deck folder>`.
The server listens on localhost only. A deck links `editor.css`, an optional design system (`ds-*.js`) and `editor.js`.

### Status

All groups of the gap list (`design-slide/design-slide-gap.md`) are built and covered by tests, apart from the points that file marks
as partly done (connector routes and snapping, magic-move transitions, build animations). `node design-slide/test/run-all.mjs` runs every
check (about 4 minutes; needs Chrome, Chromium or Edge, and `unzip` outside Windows; set `BROWSER` to a browser path if none is found).
