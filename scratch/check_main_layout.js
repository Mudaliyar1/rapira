const fs = require('fs');
const main = fs.readFileSync('views/layouts/main.ejs', 'utf8');
const lines = main.split('\n');
lines.forEach((l, i) => {
  if (l.includes('<%- body') || l.includes('navbar') || l.includes('chatbot') || l.includes('footer')) console.log(`${i+1}: ${l}`);
});

