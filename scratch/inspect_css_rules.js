const fs = require('fs');
const css = fs.readFileSync('public/css/homepage.css', 'utf8');
const lines = css.split('\n');

const lineNums = [89, 352, 489, 502, 874, 1535, 1572, 1653, 1715, 2002, 2851];
lineNums.forEach(ln => {
  const start = Math.max(0, ln - 15);
  const end = Math.min(lines.length - 1, ln + 5);
  console.log(`\n=================== Lines ${start+1} - ${end+1} ===================`);
  for (let i = start; i <= end; i++) {
    console.log(`${i+1}: ${lines[i]}`);
  }
});

