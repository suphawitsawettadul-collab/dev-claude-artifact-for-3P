// Design system for documents: Thai Union (same palette and Figtree font as design-slide/ds-tu.js).
// A doc opts in with <script src="ds-tu.js"></script> before editor.js. The editor injects fonts and css, offers the colours in the colour menu.
window.DOC_DS = {
  name: 'Thai Union 01',
  fonts: ['https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;600;700&display=swap'],
  colors: { Navy: '#002654', Royal: '#21409A', Sky: '#4AABE0', 'Light blue': '#C7DBF0', 'Grey-blue': '#EDF0F5', Header: '#0F2A56', Orange: '#F7912F', Yellow: '#FFCA35', Green: '#36BF94' },
  chart: ['#21409A', '#4AABE0', '#F7912F', '#36BF94', '#FFCA35', '#0F2A56'],
  css: `
    #doc { font-family: 'Figtree', 'Leelawadee UI', 'Segoe UI', Arial, sans-serif; color: #002654; font-size: 16px; line-height: 1.65; }
    #doc h1 { font-size: 34px; font-weight: 700; color: #002654; line-height: 1.2; margin: 1.4em 0 .4em; }
    #doc h2 { font-size: 26px; font-weight: 700; color: #002654; line-height: 1.25; margin: 1.3em 0 .4em; }
    #doc h3 { font-size: 20px; font-weight: 600; color: #21409A; line-height: 1.3; margin: 1.2em 0 .3em; }
    #doc a { color: #21409A; }
    #doc blockquote { border-left: 4px solid #4AABE0; margin: 1em 0; padding: .2em 1em; color: #21409A; background: #EDF0F5; border-radius: 0 8px 8px 0; }
    #doc table th { background: #0F2A56; color: #fff; }
    #doc table td, #doc table th { border: 1px solid #C3CBD8; }
    #doc pre { background: #EDF0F5; color: #002654; }
    #doc code { background: #EDF0F5; }
    #doc .chip { background: #C7DBF0; color: #002654; }
  `,
};
