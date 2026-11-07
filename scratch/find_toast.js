const fs = require('fs');
const files = fs.readdirSync('public/js');
files.forEach(f => {
  if (f.endsWith('.js')) {
    const c = fs.readFileSync('public/js/' + f, 'utf8');
    if (c.includes('showToast') || c.includes('toast')) console.log(f, 'has toast');
  }
});

