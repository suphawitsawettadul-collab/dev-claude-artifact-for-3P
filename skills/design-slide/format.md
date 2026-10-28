# Slide file format (Claude Slides compatible)

A slide is one `<section id="<id>" style="…">` on a fixed 1920×1080px canvas, in `project/slides/<id>.html`. The file name is the
slide id (`[A-Za-z0-9_-]{1,64}`). Nothing before or after the section: no `<html>`, `<head>`, `<style>`, `<link>`.

**Styles** are inline, from px lengths and hex or rgb colours. Avoid classes, `<style>`, `margin`, `z-index`, `em`, `var()`.
On the section: `background` (always), text defaults (`font-family`, `color`), and the layout: `display:flex; flex-direction:column`
or `display:grid`, `padding:128px` (margins; 1664×824 inside), `gap`, `align-items`, `justify-content`. Children flow in it;
`position:absolute` pins a child to the slide (`left` `top` `right` `bottom` `width` `height`; give pinned text a `width`).
Later children paint over earlier ones, so a full-bleed backdrop comes first.

**Elements** (write in reading order): `<h1> <h2> <h3> <p>` (set `font-size`, none under 24px), `<ul>`/`<ol>` of plain `<li>`, `<br>`,
inline `<b> <i> <u> <a href> <span style="color:…">`, `<div>` containers (flex row, column or grid; at most 15 deep),
`<img src alt style="width;height;object-fit:cover|contain">`, `<table>` of `<tr>`/`<th>`/`<td>`, `<svg aria-label>` (no script),
`<hr>`, `<x-shape kind="rect|rounded|ellipse|diamond|arrow-right|arrow-left|arrow-up|arrow-down|line" style="…">`,
`<x-icon name="check" style="width:96px;height:96px;color:#0f2a56">` (names in `design-slide/icons.js`: 30 icons such as check, star, user, mail, chart).
At most 200 elements per slide. In Design Slide, `x-connector` and `x-embed` are dropped.

**Speaker notes:** plain text in one `<aside>`, the section's last child.

**`project/deck.json`:** `{"v":4,"title":"Q3","order":["cover","plan"],"sections":{"s1":{"description":"Numbers","start":"cover"}},
"faces":{"source-serif-4":{"family":"Source Serif 4","href":"https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@300..700&display=swap"}},
"designSystems":[]}`. `order` lists slide ids in deck order; `faces` has at most 4 Google Fonts entries.

Example, `project/slides/plan.html`:

```html
<section id="plan" style="background:#f4f1ea;color:#0f2a56;font-family:'Segoe UI', Arial, sans-serif;padding:128px 128px 160px;display:flex;flex-direction:column;gap:48px">
<h2 style="font-size:72px;font-weight:700;line-height:1.1">Three changes</h2>
<ul style="font-size:40px;line-height:1.4"><li>One intake path</li><li>Weekly review</li></ul>
<p style="position:absolute;left:128px;bottom:64px;font-size:24px;color:#5b6475">Source: ops team</p>
<aside>Walk through each change in 30 seconds.</aside>
</section>
```
