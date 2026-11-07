const fs = require('fs');

const p = 'views/index.ejs';
let content = fs.readFileSync(p, 'utf8');

const target = `const safeCaption = captionStr.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\\r?\\n/g, ' ');').replace(/'/g, "\\\\'");`;
const replacement = `const safeCaption = captionStr.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\\r?\\n/g, ' ');`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(p, content, 'utf8');
  console.log('Successfully fixed syntax error in index.ejs!');
} else {
  console.log('Target not found directly. Let us search...');
  const idx = content.indexOf('const safeCaption =');
  const lineEnd = content.indexOf('\n', idx);
  console.log('Actual line:', content.substring(idx, lineEnd));
  content = content.substring(0, idx) + replacement + content.substring(lineEnd);
  fs.writeFileSync(p, content, 'utf8');
  console.log('Successfully replaced line!');
}

