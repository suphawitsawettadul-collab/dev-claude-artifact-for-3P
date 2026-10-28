---
tags: [project/job]
aliases: ["Design Slide editor job", "jobs-01-design-slide-editor"]
ticket: "[[design-slide]]"
job-no: 1
folder: project/demand/_unassigned-design-slide/jobs-01-design-slide-editor/
artifact:
data-sources:
tools-used:
agents: [manager, runner, bi-developer, judge]
parent: "[[design-slide]]"
owner: "[[suphawit]]"
status: in-progress
updated: 2026-10-28
created: 2026-10-28
---

# Design Slide editor (job 1)

Job 1 of [[design-slide]]. Goal: a local HTML deck editor that matches Claude Slides almost 100%, uses a design system, and exports PDF and editable PPTX, without sharing.

Tool: `BI Expert Agent/tooling/design-slide/`. Run: `node "BI Expert Agent/tooling/design-slide/serve.mjs"`, then http://localhost:4190/tu-test.html (launch config `design-slide`). Build plan: the gap list `tooling/design-slide/design-slide-gap.md`, in order A, B, C, E, D, F.

## Where / Done / Next

- Where: groups A to F built and tested; the Claude 3P skill (`skills/design-slide/`) and `open-deck.mjs` open Claude Slides format decks in the editor.
- Done: job set up, groups A, B, C, E, D, F, skill and bridge, offline export libraries, 30 test suites in `design-slide/test/`.
- Next: KB page and judge; later: connector routes and snapping, magic-move transitions, builds.

## Checklist

- [x] job set up and PoC moved
- [x] Group A: selection and undo
- [x] Group B: floating toolbars
- [x] Group C: properties panel
- [x] Group E: slides and filmstrip
- [x] Group D: insert and connector (connector routes and snapping still open)
- [x] Group F: zoom, present, export (magic move and builds still open)
- [x] Claude 3P skill and open-deck bridge
- [ ] KB page
- [ ] judge
