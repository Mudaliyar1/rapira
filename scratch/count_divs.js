const fs = require('fs');
const content = fs.readFileSync('views/index.ejs', 'utf8');
const openDivs = (content.match(/<div(\s|>)/g) || []).length;
const closeDivs = (content.match(/<\/div>/g) || []).length;
console.log('Open divs:', openDivs, 'Close divs:', closeDivs);

