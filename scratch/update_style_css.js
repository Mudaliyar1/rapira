const fs = require('fs');

const p = 'public/css/style.css';
let css = fs.readFileSync(p, 'utf8');

const titanOneGlobal = `/* ========================================================
   TITAN ONE FONT (Google Fonts / SIL Open Font License 1.1)
   Designed by Rodrigo Fuenzalida
   Official Selected Display Typeface for RAPIRA
   ======================================================== */
@font-face {
  font-family: 'Titan One';
  src: url('/fonts/titan-one.woff2') format('woff2'),
       url('/fonts/titan-one.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

/* Global Display Typography Classes for Editorial Page Titles */
.font-display,
.display-font,
.page-title,
.section-title,
.display-1,
.display-2,
.display-3,
.display-4 {
  font-family: 'Titan One', 'Impact', 'Arial Black', sans-serif !important;
  letter-spacing: -0.01em;
  line-height: 1.15;
}
`;

if (!css.includes("font-family: 'Titan One'")) {
  css = titanOneGlobal + '\n' + css;
  fs.writeFileSync(p, css, 'utf8');
  console.log('Added Titan One @font-face and display classes to public/css/style.css');
} else {
  console.log('Titan One already in style.css');
}

