const ejs = require('ejs');
const fs = require('fs');

try {
  const content = fs.readFileSync('views/index.ejs', 'utf8');
  ejs.compile(content, { filename: 'views/index.ejs' });
  console.log('EJS compilation SUCCESSFUL!');
} catch (e) {
  console.error('EJS compilation ERROR:', e);
}

