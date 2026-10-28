# Design Slide editor (job 1)

Owner: suphawit. Vault page: `BI Expert Agent/projects/design-slide-editor.md`. Ticket: `BI Expert Agent/projects/design-slide.md` (no DD number yet).

In Claude 3P the team cannot use Claude Slides. "Design Slide" is a local HTML deck editor: a page served by a small Node server and opened in the Claude desktop browser pane. It should match Claude Slides almost 100%, use a design system, and export PDF and editable PPTX, without sharing the deck. A working PoC exists; this job moved it into the vault and builds the rest.

- Tool: `BI Expert Agent/tooling/design-slide/` (editor.js, editor.css, serve.mjs, ds-tu.js, tu-test.html, deck.html, tu-bg-*.png, design-slide-gap.md).
- Run: `node "BI Expert Agent/tooling/design-slide/serve.mjs"`, then open http://localhost:4190/tu-test.html. In the desktop app, use the launch config `design-slide` (`.claude/launch.json`, port 4190).
- Build plan: the gap list `BI Expert Agent/tooling/design-slide/design-slide-gap.md`, built in order A, B, C, E, D, F.
- `judge/` is empty until the judge runs.
