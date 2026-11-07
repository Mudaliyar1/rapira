const fs = require('fs');
console.log('Searching for isLoggedIn...');
const app = fs.readFileSync('app.js', 'utf8');
const lines = app.split('\n');
lines.forEach((l, i) => {
  if (l.includes('isLoggedIn')) console.log(`${i+1}: ${l}`);
});

