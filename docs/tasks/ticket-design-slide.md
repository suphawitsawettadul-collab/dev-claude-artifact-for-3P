---
tags: [project/ticket]
aliases: ["Design Slide"]
ticket-id:
branch: demand
agents: [manager, business-analyst]
parent: "[[project-index]]"
owner: "[[suphawit]]"
status: in-progress
updated: 2026-10-28
created: 2026-10-28
requester:
deadline:
---

# Design Slide: local HTML deck editor like Claude Slides (no ticket code yet)

A new Demand. The DD number has not been issued yet. It is kept as a free ticket in the vault, with no link to another demand, until the number arrives. When it does, set `ticket-id`, rename the page to `dd-XXXX.md` and move the folder under `project/demand/`.

## Background and Objective (decided with the user, 2026-10-28)

- **Background:** in Claude 3P the team cannot use Claude Slides.
- **Objective:** a local HTML deck editor (a page served by a small Node server, opened in the Claude desktop browser pane). It should match Claude Slides almost 100%, use a design system, and export PDF and editable PPTX, without sharing.

## Jobs

- [[design-slide-editor]] (job 1): PoC moved into `tooling/design-slide/`; build by the gap list in order A, B, C, E, D, F. Job set up 2026-10-28, nothing built yet.
