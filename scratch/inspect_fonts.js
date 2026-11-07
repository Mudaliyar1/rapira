const fs = require('fs');
const path = require('path');

const fontsDir = 'public/fonts';
if (fs.existsSync(fontsDir)) {
  console.log('Fonts in public/fonts:');
  fs.readdirSync(fontsDir).forEach(f => console.log(' - ' + f));
} else {
  console.log('public/fonts does not exist');
}

const cssDir = 'public/css';
if (fs.existsSync(cssDir)) {
  console.log('\nSearching @font-face in public/css:');
  fs.readdirSync(cssDir).forEach(f => {
    if (f.endsWith('.css')) {
      const content = fs.readFileSync(path.join(cssDir, f), 'utf8');
      if (content.includes('@font-face')) {
        console.log(` - ${f} has @font-face`);
      }
      if (content.includes('Tanker') || content.includes('Notre') || content.includes('Anton')) {
        console.log(` - ${f} references Tanker/Notre/Anton`);
      }
    }
  });
}

