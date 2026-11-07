const fs = require('fs');
const css = fs.readFileSync('public/css/style.css', 'utf8');
const lines = css.split('\n');
console.log('Total lines in style.css:', lines.length);

lines.forEach((l, i) => {
  if (l.includes('h1') || l.includes('h2') || l.includes('h3') || l.includes('heading') || l.includes('font-family')) {
    console.log(`${i+1}: ${l}`);
  }
});

