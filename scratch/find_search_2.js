const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === 'scratch') return;
    if (fs.statSync(full).isDirectory()) {
      searchFiles(full);
    } else {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('nav-link p-0') || content.includes('/content') && content.includes('Search')) {
        console.log('Found in:', full);
      }
    }
  });
}

searchFiles('.');

