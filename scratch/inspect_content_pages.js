const fs = require('fs');
if (fs.existsSync('views/content')) {
  fs.readdirSync('views/content').forEach(f => {
    if (f.endsWith('.ejs')) {
      const c = fs.readFileSync('views/content/' + f, 'utf8');
      const h1s = c.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
      const h2s = c.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi);
      console.log(`views/content/${f}:`);
      if (h1s) h1s.forEach(h => console.log('   h1: ' + h.replace(/\s+/g, ' ').substring(0, 80)));
      if (h2s) h2s.forEach(h => console.log('   h2: ' + h.replace(/\s+/g, ' ').substring(0, 80)));
    }
  });
}

