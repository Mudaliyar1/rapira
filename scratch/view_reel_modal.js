const fs = require('fs');

const content = fs.readFileSync('views/index.ejs', 'utf8');
const idx = content.indexOf('id="rhReelModal"');
console.log(content.substring(idx - 60));

