const fs = require('fs');
const path = require('path');

const checkDirs = ['views/artists', 'views/concerts', 'views/content', 'views/reels', 'views/merchandise'];

checkDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`\n=== Files in ${dir} ===`);
    fs.readdirSync(dir).forEach(f => {
      if (f.endsWith('.ejs')) {
        const c = fs.readFileSync(path.join(dir, f), 'utf8');
        const h1s = c.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
        const h2s = c.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi);
        console.log(` ${f}:`);
        if (h1s) h1s.forEach(h => console.log('   h1: ' + h.replace(/\s+/g, ' ').substring(0, 80)));
        if (h2s) h2s.forEach(h => console.log('   h2: ' + h.replace(/\s+/g, ' ').substring(0, 80)));
      }
    });
  }
});

