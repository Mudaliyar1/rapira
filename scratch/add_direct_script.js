const fs = require('fs');

const p = 'views/index.ejs';
let content = fs.readFileSync(p, 'utf8');

if (!content.includes('<script src="/js/homepage-motion.js"></script>')) {
  content = content.trimEnd() + '\n<script src="/js/homepage-motion.js"></script>\n';
  fs.writeFileSync(p, content, 'utf8');
  console.log('Added direct script tag to views/index.ejs');
} else {
  console.log('Script tag already present');
}

