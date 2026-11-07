const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === 'scratch') return;
    if (fs.statSync(full).isDirectory()) {
      searchFiles(full);
    } else if (file.endsWith('.js') || file.endsWith('.ejs') || file.endsWith('.css') || file.endsWith('.html')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('title="Search"') || content.includes('style="font-size:1.05rem;"')) {
        console.log('Found in:', full);
      }
    }
  });
}

searchFiles('.');

