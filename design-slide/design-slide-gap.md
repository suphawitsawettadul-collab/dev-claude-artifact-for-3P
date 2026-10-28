# Design Slide — gap list vs Claude Slides

Source: Slides type docs (format.md, styles.md, layout.md, view-state.md, diagrams.md) and a read-only walk through the
"Cutting AI Cost" deck on claude.ai, 2026-10-28. Have = Design Slide already does it.

## A. Selection and editing
| # | Claude Slides | Design Slide |
|---|---|---|
| A1 | Click selects any leaf element (text, image, shape, painted box, table cell, slide background); handles on every selection | Only inserted boxes are selectable; text is click-to-type |
| A2 | Click selected text again to type | Text types on first click |
| A3 | Drag a flow element: it becomes pinned (absolute) at its spot; siblings reflow | Only inserted boxes move |
| A4 | Right-click menu: Cut, Copy, Copy link to slide, Paste, Duplicate (Ctrl+D), Bring to front (]), Send to back ([), Group (Ctrl+G), Ungroup (Ctrl+Shift+G), Delete (Backspace) | None |
| A5 | Undo / Redo (Ctrl+Z / Ctrl+Shift+Z) | Only native text undo |

## B. Floating toolbars (above the selection)
| # | Claude Slides | Design Slide |
|---|---|---|
| B1 | Text: text-style dropdown (theme styles with size, searchable), colour, B, I, U, link, bullet list, align popover (L/C/R/justify), comment, ⋯ | Have (group B): style dropdown (Theme / Custom, search, DS `textStyles`), colour, B / I / U (range or whole element), link, bullets, align, dots. No comment button (not copied). |
| B2 | Box / shape / slide background: fill, crop (image), radius, spacing (padding), comment, ⋯ | Have: fill (None, slide background), crop, radius (Pill), spacing, dots |
| B3 | Table cell: font · size dropdown, text colour, fill, align, radius, spacing, comment, ⋯ | Have: font · size, text colour, row fill, column align, radius, spacing, dots |
| B4 | Colour picker: Theme tab ("In this slide", design-system tokens by name, search) and Custom tab (solid / gradient / image, SV square, hue, opacity, hex, eyedropper) | Have: Theme tab (search, In this slide, DS palette, check mark) and Custom tab (solid / gradient, SV square, hue, opacity, hex, eyedropper). No Image type. |

Group B notes (editor.js, section "floating toolbars"): one `#ed-tb` for the last selected element, popovers in `#ed-pop`; every edit runs through `DeckEditor.change(fn, key)`, and calls with the same key within 0.8 s (slider or picker drag) share one undo step. Text styles live in the design system file as `textStyles`; without one the editor uses Title / Heading / Subheading / Body / Caption scaled by slide width / 1280. PPTX export reads the result: colour and font runs, `<b> <i> <u>`, hyperlink on `<a href>`, a gradient exports as its first colour.

## C. Properties panel (⋯ in the toolbar or the panel button, top right)
Have (group C, tests t-c1 and t-c2): Size (W, H with Fill / Hug / Fixed), Layout (padding, per side; direction, gap, align, justify on
containers), Text (style, font, weight, size, line height, letter spacing, colour, align, resize = shrink to fit, + case / line),
Appearance (background, opacity, radius per corner, border none / solid / dashed / dotted with width and colour), Effects (+ shadow,
blur), Advanced (X / Y or Pin, rotation, id, alt text). Slide selected: background, layout, transition. The panel follows the selection
live, every edit is one undo step, and speaker notes open under the slide (book button).

## D. Insert
| # | Claude Slides | Design Slide |
|---|---|---|
| D1 | Shapes menu with keys: Rectangle R, Rounded Shift+R, Ellipse O, Diamond D, Arrow right/left/up/down, Line L, Connector Shift+L | Have: all ten, same keys; PPTX exports diamond and arrows as native shapes |
| D2 | Connector: snaps to edge midpoints/corners, heads none/open/filled, route straight/hv/vh/elbow, dashed | Partly: Shift+L inserts a straight connector with a filled arrow head (exports as a PowerPoint line with an arrow). No snapping, routes or head choice yet. |
| D3 | Icons (`x-icon`, 30 names) | Have: Icons menu, 30 names in `icons.js`; `<x-icon>` in a Slides-format deck becomes the same svg |
| D4 | Text T, Image, Table buttons | Have |

## E. Slides and filmstrip
| # | Claude Slides | Design Slide |
|---|---|---|
| E1 | "+" opens a New slide gallery with previews | Have: gallery of scaled previews (Blank + 11 layouts, or the design system's layouts); a new slide takes the look of the current one |
| E2 | Thumbnail ⋯ menu | Have: Duplicate slide, Skip slide, Add slide after, Move left, Move right, Delete slide (no "Copy slide / Copy link / Set as thumbnail") |
| E3 | Speaker notes open UNDER the slide | Have |
| E4 | Grid view in rows by section, section description on each row | Have: `data-section` on a section's first slide (open-deck.mjs fills it from deck.json). No zoom. |
| E5 | Skip slide | Have: skipped in present, PDF, PPTX, PNG and the web page; dimmed in the strip |
| E6 | Multi-select slides in the strip | Have: Ctrl / Shift click, then duplicate, skip or delete the pick |

## F. View, present, export
| # | Claude Slides | Design Slide |
|---|---|---|
| F1 | Zoom menu: Zoom in Ctrl+, Zoom out Ctrl−, Fit, 25–200 % | Have (no Undo / Redo rows in the menu) |
| F2 | Download: PDF, Web page (.html), Current slide (.png), PowerPoint | Have: PDF, web page (stand-alone, arrow keys), PNG (2x), PPTX. One PowerPoint variant only. |
| F3 | Present: transitions fade / push / magic; builds | Partly: Fade and Push per slide (slide properties, also in the web page). No magic move, no builds. |
| F4 | Title menu: Export, Rename, Duplicate, Share, Permissions, Refresh, Pin, Storage, Delete | Have: Save, Rename, exports, Present, Refresh |
| F5 | Text shrinks to fit an over-full box (60 % floor) | Have |

PDF, PPTX and PNG use libraries bundled in this folder (`lib-*.js`, see `lib-NOTICE.md`), so exports work offline.

## Not copied on purpose
Share, Permissions, comments, Start chat, presence avatars (all need the claude.ai service; the deck stays local).
