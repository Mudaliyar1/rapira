const fs = require('fs');
const lines = fs.readFileSync('views/index.ejs', 'utf8').split('\n');
console.log('Total lines:', lines.length);
console.log('First 30 lines:');
for (let i = 0; i < 30; i++) console.log(`${i+1}: ${lines[i]}`);
console.log('Last 20 lines:');
for (let i = lines.length - 20; i < lines.length; i++) console.log(`${i+1}: ${lines[i]}`);

