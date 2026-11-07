const fs = require('fs');

const indexHtml = fs.readFileSync('views/index.ejs', 'utf8');
const lines = indexHtml.split('\n');

const headingsToFind = [
  'MUSIC NEVER SLEEPS',
  'HOW RAPIRA WORKS',
  'DISCOVER. CONNECT. EXPERIENCE.',
  'FEATURED ARTISTS',
  'UPCOMING CONCERTS',
  'LATEST RELEASES',
  'Trending Reels',
  'Reels',
  'ARE YOU AN ARTIST',
  'DISCOVER',
  'CONNECT',
  'EXPERIENCE'
];

headingsToFind.forEach(h => {
  console.log(`\n--- Searching for: "${h}" ---`);
  lines.forEach((l, i) => {
    if (l.toLowerCase().includes(h.toLowerCase())) {
      console.log(`${i+1}: ${l.trim()}`);
    }
  });
});

