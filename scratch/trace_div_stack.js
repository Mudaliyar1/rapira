const fs = require('fs');
const content = fs.readFileSync('views/index.ejs', 'utf8');
const lines = content.split('\n');
const stack = [];
lines.forEach((line, lineNo) => {
  let pos = 0;
  while (true) {
    const nextOpen = line.indexOf('<div', pos);
    const nextClose = line.indexOf('</div>', pos);
    if (nextOpen === -1 && nextClose === -1) break;
    if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
      const match = line.slice(nextOpen).match(/<div([^>]*)>/);
      const attrs = match ? match[1].trim() : '';
      stack.push({ lineNo: lineNo + 1, attrs });
      pos = nextOpen + 4;
    } else {
      const popped = stack.pop();
      if (!popped) {
        console.log(`Unmatched </div> at line ${lineNo + 1}: ${line.trim()}`);
      }
      pos = nextClose + 6;
    }
  }
});
console.log('Remaining unclosed divs at EOF:', stack.length);
stack.forEach(s => console.log(`Unclosed: line ${s.lineNo} -> ${s.attrs}`));

