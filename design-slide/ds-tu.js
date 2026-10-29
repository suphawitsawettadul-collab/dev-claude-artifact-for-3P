// Design system: Thai_Union_Slide_Template_01.
// A deck opts in with <script src="ds-tu.js"></script> before editor.js. The editor injects css + fonts on load,
// offers the layouts on "+", the colours in the colour menu, and maps web fonts to PowerPoint fonts on export.
const BG = (document.currentScript?.getAttribute('src') || '').replace(/[^/]*$/, ''); // folder of this file as the deck names it ('' or '_ds/'), so the backgrounds follow it
window.DECK_DS = {
  name: 'Thai Union 01',
  width: 1920, height: 1080,
  fonts: ['https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;600;700&display=swap'],
  pptxFonts: { Figtree: 'Aptos' }, // Aptos is the template font; Figtree is its web stand-in
  colors: {
    Navy: '#002654', Royal: '#21409A', Sky: '#4AABE0', 'Light blue': '#C7DBF0', 'Grey-blue': '#EDF0F5',
    Header: '#0F2A56', Orange: '#F7912F', Yellow: '#FFCA35', Green: '#36BF94', White: '#FFFFFF',
  },
  defaults: { fill: '#C7DBF0', line: '#4AABE0', text: '#002654' },
  // Text styles for the text-style dropdown (same values as the classes in css below; group order is the menu order).
  textStyles: [
    { group: 'Cover', items: [
      { name: 'cover-title', size: 80, weight: 700, color: '#002654' },
      { name: 'cover-subtitle', size: 36, weight: 400, color: '#21409A' },
      { name: 'cover-date', size: 32, weight: 400, color: '#002654' } ] },
    { group: 'Gradient slides', items: [
      { name: 'section-number', size: 120, weight: 300, color: '#FFFFFF' },
      { name: 'section-title', size: 120, weight: 600, color: '#FFFFFF' },
      { name: 'closing-title', size: 108, weight: 700, color: '#FFFFFF' },
      { name: 'agenda-heading', size: 88, weight: 400, color: '#002654' },
      { name: 'agenda-item', size: 40, weight: 600, color: '#FFFFFF' } ] },
    { group: 'Content', items: [
      { name: 'title', size: 56, weight: 700, color: '#002654' },
      { name: 'subtitle', size: 36, weight: 400, color: '#4AABE0' },
      { name: 'body', size: 28, weight: 400, color: '#002654' },
      { name: 'table', size: 26, weight: 400, color: '#002654' },
      { name: 'page', size: 24, weight: 400, color: '#002654' } ] },
  ],
  css: `
    .slide { font-family: 'Figtree', 'Leelawadee UI', Arial, sans-serif; color: #002654; }
    .slide > .tu-bg { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; object-fit: cover; }
    .slide > * { position: absolute; margin: 0; }
    .tu-cover-title { left: 556px; top: 452px; width: 1245px; height: 286px; display: flex; flex-direction: column; justify-content: flex-end; text-align: right; }
    .tu-cover-title h1 { font-size: 80px; font-weight: 700; line-height: 1.1; margin: 0; }
    .tu-cover-title p { font-size: 36px; color: #21409A; margin: 16px 0 0; line-height: 1.3; }
    .tu-cover-date { right: 119px; top: 975px; font-size: 32px; text-align: right; }
    .tu-agenda-h { left: 165px; top: 240px; font-size: 88px; font-weight: 400; }
    .tu-agenda-list { left: 915px; top: 300px; width: 879px; display: flex; flex-direction: column; }
    .tu-agenda-item { display: flex; gap: 40px; align-items: center; height: 170px; border-bottom: 1px solid rgba(255,255,255,.8); color: #fff; }
    .tu-agenda-item b { font-size: 120px; font-weight: 300; width: 125px; line-height: 1; }
    .tu-agenda-item h3 { font-size: 40px; font-weight: 600; margin: 0; }
    .tu-agenda-item p { font-size: 28px; margin: 6px 0 0; }
    .tu-title { left: 72px; top: 35px; width: 1776px; font-size: 56px; font-weight: 700; line-height: 1.2; }
    .tu-sub { left: 72px; top: 112px; width: 1776px; font-size: 36px; color: #4AABE0; }
    .tu-body { left: 72px; top: 200px; width: 1776px; font-size: 28px; line-height: 1.5; }
    .tu-body ul { margin: 0; padding-left: 1.2em; display: flex; flex-direction: column; gap: 16px; }
    .tu-page { left: 40px; top: 1000px; font-size: 24px; }
    .tu-table { left: 72px; top: 200px; width: 1776px; border-collapse: collapse; font-size: 26px; }
    .tu-table th { background: #0F2A56; color: #fff; text-align: left; padding: 16px 20px; font-weight: 700; }
    .tu-table td { padding: 16px 20px; border-bottom: 1px solid #C3CBD8; }
    .tu-table tr:nth-child(even) td { background: #EDF0F5; }
    .tu-status { display: inline-block; padding: 4px 16px; border-radius: 999px; font-size: 22px; font-weight: 600; }
    .tu-done { background: #E8F5E9; color: #1E6B4F; } .tu-prog { background: #D6E6FA; color: #003A80; } .tu-risk { background: #FDECEA; color: #9B2C21; }
    .tu-cards { left: 72px; top: 560px; width: 1776px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }
    .tu-card { background: #EDF0F5; border-radius: 24px; padding: 40px; }
    .tu-card b { display: block; font-size: 96px; color: #21409A; line-height: 1.1; }
    .tu-card span { font-size: 28px; }
    .tu-sec-num { right: 110px; top: 110px; font-size: 120px; font-weight: 300; color: #fff; }
    .tu-sec-title { right: 110px; top: 500px; width: 1400px; font-size: 120px; font-weight: 600; color: #fff; text-align: right; line-height: 1.1; }
    .tu-close { right: 60px; top: 740px; width: 1200px; font-size: 108px; font-weight: 700; color: #fff; text-align: right; }
  `,
  layouts: {
    cover: { name: 'Cover', html: `
      <img class="tu-bg" src="${BG}tu-bg-cover.png" alt="">
      <div class="tu-cover-title"><h1 data-edit>Presentation title</h1><p data-edit>Subtitle</p></div>
      <div class="tu-cover-date" data-edit>1 January 2026</div>` },
    agenda: { name: 'Agenda', html: `
      <img class="tu-bg" src="${BG}tu-bg-agenda.png" alt="">
      <div class="tu-agenda-h" data-edit>Agenda</div>
      <div class="tu-agenda-list">
        <div class="tu-agenda-item"><b>01</b><div><h3 data-edit>First topic</h3><p data-edit>Short line</p></div></div>
        <div class="tu-agenda-item"><b>02</b><div><h3 data-edit>Second topic</h3><p data-edit>Short line</p></div></div>
        <div class="tu-agenda-item"><b>03</b><div><h3 data-edit>Third topic</h3><p data-edit>Short line</p></div></div>
      </div>` },
    content: { name: 'Content', html: `
      <img class="tu-bg" src="${BG}tu-bg-content.png" alt="">
      <div class="tu-title" data-edit>Slide title</div>
      <div class="tu-sub" data-edit>Subtitle</div>
      <div class="tu-body"><ul data-edit><li>First point</li><li>Second point</li><li>Third point</li></ul></div>
      <div class="tu-page" data-page-number></div>` },
    numbers: { name: 'Big numbers', html: `
      <img class="tu-bg" src="${BG}tu-bg-content.png" alt="">
      <div class="tu-title" data-edit>Key numbers</div>
      <div class="tu-sub" data-edit>Subtitle</div>
      <div class="tu-cards">
        <div class="tu-card"><b data-edit>00</b><span data-edit>Label</span></div>
        <div class="tu-card"><b data-edit>00</b><span data-edit>Label</span></div>
        <div class="tu-card"><b data-edit>00</b><span data-edit>Label</span></div>
      </div>
      <div class="tu-page" data-page-number></div>` },
    table: { name: 'Table', html: `
      <img class="tu-bg" src="${BG}tu-bg-content.png" alt="">
      <div class="tu-title" data-edit>Status</div>
      <div class="tu-sub" data-edit>Subtitle</div>
      <table class="tu-table">
        <tr><th data-edit>Item</th><th data-edit>Owner</th><th data-edit>Status</th></tr>
        <tr><td data-edit>Item one</td><td data-edit>Name</td><td><span class="tu-status tu-done" data-edit>Done</span></td></tr>
        <tr><td data-edit>Item two</td><td data-edit>Name</td><td><span class="tu-status tu-prog" data-edit>In progress</span></td></tr>
        <tr><td data-edit>Item three</td><td data-edit>Name</td><td><span class="tu-status tu-risk" data-edit>At risk</span></td></tr>
      </table>
      <div class="tu-page" data-page-number></div>` },
    section: { name: 'Section', html: `
      <img class="tu-bg" src="${BG}tu-bg-section.png" alt="">
      <div class="tu-sec-num" data-edit>01</div>
      <div class="tu-sec-title" data-edit>Section title</div>` },
    closing: { name: 'Closing', html: `
      <img class="tu-bg" src="${BG}tu-bg-closing.png" alt="">
      <div class="tu-close" data-edit>Thank You</div>` },
  },
};
