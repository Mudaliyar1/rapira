const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern, extFilter) {
  const matches = [];
  function recurse(current) {
    const list = fs.readdirSync(current);
    for (const item of list) {
      if (item === 'node_modules' || item === '.git' || item === 'scratch') continue;
      const full = path.join(current, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        recurse(full);
      } else if (!extFilter || extFilter.some(ext => item.endsWith(ext))) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          if (pattern.test(content)) {
            matches.push(full);
          }
        } catch (e) {}
      }
    }
  }
  recurse(dir);
  return matches;
}

console.log('Files mentioning fonts.googleapis.com:');
console.log(searchDir('views', /fonts\.googleapis\.com/i, ['.ejs', '.html']));

console.log('\nFiles mentioning font in views:');
console.log(searchDir('views', /font/i, ['.ejs']));

