const fs = require('fs');
const path = require('path');

const cssDir = 'public/css';
fs.readdirSync(cssDir).forEach(f => {
  if (f.endsWith('.css')) {
    const content = fs.readFileSync(path.join(cssDir, f), 'utf8');
    const matches = content.match(/font-family:[^;]+;/g);
    if (matches) {
      console.log(`\n--- ${f} (${matches.length} font-family declarations) ---`);
      // Print unique declarations
      const unique = Array.from(new Set(matches.map(m => m.trim())));
      unique.forEach(u => console.log('  ' + u));
    }
  }
});

