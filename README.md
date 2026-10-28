# dev-claude-artifact-for-3P

สองเครื่องมือนี้เป็น **clone ของ Claude Artifact แบบ Slides และ Docs** สำหรับใช้กับ **Claude 3P mode** ซึ่งไม่มี artifact ชนิดเหล่านี้ให้ใช้
ทำงานเหมือนกัน: สั่ง "create slides" หรือ "create a document" แล้ว Claude เขียนไฟล์ จากนั้นเปิดใน editor ในเครื่อง แก้ได้เหมือนบน claude.ai
แล้ว export ได้ ไฟล์อยู่ในเครื่องของคุณ ไม่มีการแชร์ออกไป และใช้ **Design System ของตัวเองได้** (ดูหัวข้อด้านล่าง)

| เครื่องมือ | ใช้แทน | โฟลเดอร์ | Skill |
|---|---|---|---|
| Design Slide | Claude Slides | `design-slide/` | `skills/design-slide/` |
| Design Doc | Claude Docs | `design-doc/` | `skills/design-doc/` |

## หน้าตาของเครื่องมือ

**Design Slide** (ตัวอย่างใช้ Thai Union design system)

![Design Slide](docs/screenshots/design-slide-editor.png)

**Design Doc** (เอกสารหลายแท็บ, diagram, ตาราง, Comments / History / Export)

![Design Doc](docs/screenshots/design-doc-editor.png)

## เริ่มใช้งานเร็ว

ต้องมี Node.js และ Chrome, Chromium หรือ Edge ในเครื่อง

```bash
# Slide: เปิดเด็คตัวอย่าง (รูปแบบไฟล์เดียวกับ Claude Slides)
node design-slide/open-deck.mjs design-slide/examples/slides-format --ds tu

# Doc: เปิดเอกสารตัวอย่าง
node design-doc/open-doc.mjs design-doc/examples/proposal --ds tu --byline "ชื่อคุณ"
```

คำสั่งจะพิมพ์ `OPEN: http://localhost:...` ให้เปิดใน browser pane ของ Claude desktop (หรือ browser ทั่วไป)

## ใช้ใน Claude 3P

คัดลอก `skills/design-slide/` และ `skills/design-doc/` ไปไว้ที่ `~/.claude/skills/` แล้วตั้ง `DESIGN_SLIDE_DIR` / `DESIGN_DOC_DIR`
เป็นพาธเต็มของโฟลเดอร์ `design-slide/` / `design-doc/` ใน repo นี้ หลังจากนั้นสั่ง "create slides" หรือ "create a document"
Claude จะใช้กติกาออกแบบเดียวกับ Claude Slides/Docs แต่เปิดผลลัพธ์ใน Design Slide / Design Doc แทน

## สร้าง Design System ของตัวเอง

Design System คือไฟล์ JavaScript เล็กๆ ที่เครื่องมือโหลดก่อน `editor.js` ตัวอย่างคือ Thai Union (`ds-tu.js`, เรียกด้วย `--ds tu`)

1. Slide: คัดลอก `design-slide/ds-tu.js` เป็น `design-slide/ds-<ชื่อ>.js` แล้วแก้ `window.DECK_DS`: `name`, `width/height`, `fonts`,
   `colors`, `textStyles`, `css` และ `layouts` (layout ที่ขึ้นในปุ่ม "+")
2. Doc: คัดลอก `design-doc/ds-tu.js` เป็น `design-doc/ds-<ชื่อ>.js` แล้วแก้ `window.DOC_DS`: `name`, `fonts`, `colors`, `chart`, `css`
3. เปิดด้วย `--ds <ชื่อ>` เช่น `node design-slide/open-deck.mjs <โฟลเดอร์เด็ค> --ds acme`

หมายเหตุตรงๆ: ตอนนี้ยังไม่มีตัวช่วยสร้าง design system อัตโนมัติ ต้องเขียนไฟล์ `ds-*.js` เอง (หรือให้ Claude เขียนจาก brand guide ให้)
และผมยังไม่ได้ทดสอบกับ design system ที่ไม่ใช่ Thai Union

---

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

## Design Doc

A local HTML document editor that stands in for Claude Docs in 3P mode: tabs, floating toolbar, `/` menu, tables, charts, diagrams, comment threads, version history and export to Word, PDF and Markdown. See `design-doc/README.md`; the skill is `skills/design-doc/`; tests: `node design-doc/test/run-all.mjs`.
