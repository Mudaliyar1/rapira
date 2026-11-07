const fs = require('fs');
const lines = fs.readFileSync('routes/index.js', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('homeReels') || l.includes('formattedReels') || l.includes('recentReels')) {
    console.log(`${i+1}: ${l}`);
  }
});

