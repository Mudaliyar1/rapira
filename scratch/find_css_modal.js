const fs = require('fs');
const css = fs.readFileSync('public/css/homepage.css', 'utf8');
const lines = css.split('\n');
lines.forEach((l, i) => {
  if (l.includes('rh-reel-modal') || l.includes('rh-modal-open')) {
    console.log(`${i+1}: ${l}`);
  }
});

