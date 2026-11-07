const fs = require('fs');

const css = fs.readFileSync('public/css/homepage.css', 'utf8');
const lines = css.split('\n');

const selectors = [
  '.rh-hero-headline',
  '.rh-hero-lineup',
  '.rh-section-title',
  '.rh-how-headline',
  '.rh-how-kicker',
  '.rh-card-number',
  '.rh-card-title',
  '.rh-artist-cta-title',
  '.footer-brand',
  '.navbar-brand'
];

selectors.forEach(sel => {
  console.log(`\n=== Selector: ${sel} ===`);
  lines.forEach((l, i) => {
    if (l.includes(sel)) {
      console.log(`${i+1}: ${l}`);
    }
  });
});

