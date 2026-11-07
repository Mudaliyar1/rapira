const fs = require('fs');
fs.readdirSync('views').forEach(f => {
  if (f.includes('content') || f.includes('music') || f.includes('discover')) {
    console.log(f);
  }
});

