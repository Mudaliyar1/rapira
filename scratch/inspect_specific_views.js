const fs = require('fs');

const files = [
  'views/content-library.ejs',
  'views/artists/index.ejs',
  'views/concerts/index.ejs',
  'views/reels/index.ejs'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    console.log(`\n=== ${f} ===`);
    const c = fs.readFileSync(f, 'utf8');
    const h1s = c.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi);
    if (h1s) h1s.forEach(h => console.log('  ' + h.replace(/\s+/g, ' ').substring(0, 100)));
  }
});

