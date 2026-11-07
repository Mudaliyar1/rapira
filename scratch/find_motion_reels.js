const fs = require('fs');
const js = fs.readFileSync('public/js/homepage-motion.js', 'utf8');
const lines = js.split('\n');
lines.forEach((l, i) => {
  if (l.includes('openRapiraReel') || l.includes('rhReelModal') || l.includes('Reel') || l.includes('modal')) {
    console.log(`${i+1}: ${l}`);
  }
});

