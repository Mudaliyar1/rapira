const fs = require('fs');
const lines = fs.readFileSync('views/index.ejs', 'utf8').split('\n');
lines.forEach((line, idx) => {
  if (line.includes('rhReelModal') || line.includes('openRapiraReel') || line.includes('Trending Reels') || line.includes('homeReels')) {
    console.log(`${idx + 1}: ${line}`);
  }
});

