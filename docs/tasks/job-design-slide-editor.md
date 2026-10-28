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

- Where: job folder set up; PoC files copied into `tooling/design-slide/`; nothing built yet.
- Done: job folder and README, PoC moved (byte copies), ticket and job pages, launch config `design-slide`.
- Next: Group A (selection and undo).

## Checklist

- [x] job set up and PoC moved
- [ ] Group A: selection and undo
- [ ] Group B: floating toolbars
- [ ] Group C: properties panel
- [ ] Group E: slides and filmstrip
- [ ] Group D: insert and connector
- [ ] Group F: zoom, present, export
- [ ] KB page
- [ ] judge
