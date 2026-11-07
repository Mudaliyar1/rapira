const fs = require('fs');
const app = fs.readFileSync('app.js', 'utf8');
const lines = app.split('\n');
lines.forEach((l, i) => {
  if (l.includes('layout') || l.includes('view engine')) console.log(`${i+1}: ${l}`);
});

