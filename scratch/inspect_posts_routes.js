const fs = require('fs');
const lines = fs.readFileSync('routes/posts.js', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('router.post') || l.includes('router.get')) {
    console.log(`${i+1}: ${l}`);
  }
});

