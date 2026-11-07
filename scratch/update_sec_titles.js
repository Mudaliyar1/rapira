const fs = require('fs');

const p = 'public/css/homepage.css';
let css = fs.readFileSync(p, 'utf8');

// 1. Update .rh-section-title
const oldSec = `.rapira-homepage .rh-section-title {
  font-family: 'Anton', sans-serif;
  font-size: clamp(1.85rem, 3.4vw, 2.5rem);
  font-weight: 400;
  color: var(--rh-crimson);
  letter-spacing: 0.02em;
  margin: 0;
  line-height: 1.1;
  display: flex;
  align-items: center;
}`;

const newSec = `.rapira-homepage .rh-section-title {
  font-family: 'Titan One', 'Impact', 'Arial Black', sans-serif !important;
  font-size: clamp(1.6rem, 2.8vw, 2.25rem);
  font-weight: 400;
  color: var(--rh-crimson);
  letter-spacing: -0.01em;
  margin: 0;
  line-height: 1.15;
  display: flex;
  align-items: center;
}`;

if (css.includes(oldSec)) {
  css = css.replace(oldSec, newSec);
  console.log('Updated .rh-section-title to Titan One');
} else {
  console.log('oldSec not found exactly, searching substring...');
  const idx = css.indexOf('.rapira-homepage .rh-section-title {');
  const end = css.indexOf('}', idx);
  css = css.substring(0, idx) + newSec + css.substring(end + 1);
  console.log('Replaced .rh-section-title via index');
}

// 2. Update .rh-how-headline
const oldHow = `.rapira-homepage .rh-how-headline {
  font-family: 'Notre', 'Tanker', 'Anton', sans-serif !important;
  font-size: clamp(2.4rem, 5.2vw, 4.2rem);
  line-height: 0.95;
  color: var(--rh-crimson);
  text-transform: uppercase;
  letter-spacing: 0.01em;
  margin: 0 auto 0.75rem auto;
}`;

const newHow = `.rapira-homepage .rh-how-headline {
  font-family: 'Titan One', 'Impact', 'Arial Black', sans-serif !important;
  font-size: clamp(1.9rem, 4.2vw, 3.3rem);
  line-height: 1.1;
  color: var(--rh-crimson);
  text-transform: uppercase;
  letter-spacing: -0.01em;
  margin: 0 auto 0.75rem auto;
}`;

if (css.includes(oldHow)) {
  css = css.replace(oldHow, newHow);
  console.log('Updated .rh-how-headline to Titan One');
} else {
  console.log('oldHow not found exactly, searching substring...');
  const idx = css.indexOf('.rapira-homepage .rh-how-headline {');
  const end = css.indexOf('}', idx);
  css = css.substring(0, idx) + newHow + css.substring(end + 1);
  console.log('Replaced .rh-how-headline via index');
}

fs.writeFileSync(p, css, 'utf8');
console.log('Successfully updated .rh-section-title and .rh-how-headline in homepage.css!');

