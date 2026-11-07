const fs = require('fs');
const path = require('path');

function searchDir(dir, query) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        searchDir(fullPath, query);
      }
    } else if (entry.isFile()) {
      if (/\.(js|ejs|html|css)$/.test(entry.name)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (query.test(content)) {
            console.log('Match in:', fullPath);
            const lines = content.split('\n');
            lines.forEach((l, idx) => {
              if (query.test(l)) {
                console.log(`  Line ${idx + 1}: ${l.trim().substring(0, 120)}`);
              }
            });
          }
        } catch (e) {}
      }
    }
  }
}

console.log('--- Search for Loading...... or page loader ---');
searchDir('views', /Loading\.{2,}|page-loader|global-loader|loading-overlay|preloader/i);
searchDir('public', /Loading\.{2,}|page-loader|global-loader|loading-overlay|preloader/i);

