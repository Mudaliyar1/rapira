const fs = require('fs');

const css = fs.readFileSync('public/css/homepage.css', 'utf8');
const lines = css.split('\n');

lines.forEach((line, i) => {
  if (line.includes('Notre') || line.includes('Tanker') || line.includes('Anton')) {
    console.log(`${i + 1}: ${line}`);
  }
});

