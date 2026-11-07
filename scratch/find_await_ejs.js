const fs = require('fs');
const content = fs.readFileSync('views/index.ejs', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('await') && l.includes('<%')) console.log(`${i+1}: ${l}`);
});

