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

## C. Properties panel (⋯ or the panel button, top right)
Size (W, H with Fill / Hug / Fixed), Layout (padding), Text (style, font, weight, size, line height, letter spacing, colour,
align, resize = shrink text to fit), Appearance (background, opacity, radius, border none/solid/dashed/dotted),
Effects (+ shadow …), Advanced. Design Slide: none (its panel button opens notes).

## D. Insert
| # | Claude Slides | Design Slide |
|---|---|---|
| D1 | Shapes menu with keys: Rectangle R, Rounded Shift+R, Ellipse O, Diamond D, Arrow right/left/up/down, Line L, Connector Shift+L | Rect, rounded, ellipse, line; no keys |
| D2 | Connector: snaps to edge midpoints/corners, heads none/open/filled, route straight/hv/vh/elbow, dashed | None |
| D3 | Icons (`x-icon`, 30 names) | None |
| D4 | Text T, Image, Table buttons | Have |

## E. Slides and filmstrip
| # | Claude Slides | Design Slide |
|---|---|---|
| E1 | "+" opens a New slide gallery with previews: Blank, Title, Section, Title + body, Key points, Compare, Bullets, Two columns, Table, Quote, Image + caption, Closing | Text menu of DS layouts |
| E2 | Thumbnail ⋯ menu: Duplicate slide, Copy slide, Copy link to slide, Skip slide, Set as thumbnail, Add slide after, Move left, Move right, Delete slide | Hover dup / delete, drag |
| E3 | Speaker notes open UNDER the slide (book icon "Show speaker notes") | Side panel |
| E4 | Grid ("Canvas") view: slides in rows by section, section description on each row, zoomable | Flat grid |
| E5 | Skip slide (`hidden`) | None |
| E6 | Multi-select slides in the strip | None |

## F. View, present, export
| # | Claude Slides | Design Slide |
|---|---|---|
| F1 | Zoom menu: Zoom in Ctrl+, Zoom out Ctrl−, Fit the slide, Now N%, 25–200 %, Undo, Redo | Fit, 25–100 % |
| F2 | Download: PDF, Web page (.html), Current slide as image (.png), PowerPoint current fonts, PowerPoint basic fonts | PDF, PPTX |
| F3 | Present: transitions fade / push / magic; build-in / build-out fade / rise / drop / left / right / scale / pop with order | Plain present |
| F4 | Title menu: Export, Rename, Duplicate, Share, Permissions, Refresh, Pin, Storage, Delete | Save, export, present |
| F5 | Text shrinks to fit an over-full box (60 % floor) | None |

## Not copied on purpose
Share, Permissions, comments, Start chat, presence avatars (all need the claude.ai service; the deck stays local).
