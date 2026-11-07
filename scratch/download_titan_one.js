const https = require('https');
const fs = require('fs');
const path = require('path');

const fontsDir = path.join(__dirname, '../public/fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

// 1. Fetch Google Fonts CSS with Chrome modern user agent for woff2
const options = {
  hostname: 'fonts.googleapis.com',
  path: '/css2?family=Titan+One&display=swap',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

https.get(options, (res) => {
  let css = '';
  res.on('data', chunk => css += chunk);
  res.on('end', () => {
    console.log('Google Fonts CSS:\n', css);
    
    // Extract url(...)
    const match = css.match(/src:\s*url\(([^)]+)\)\s*format\('woff2'\)/);
    if (!match) {
      console.error('Could not find woff2 URL in CSS!');
      return;
    }
    const fontUrl = match[1];
    console.log('Downloading Titan One WOFF2 from:', fontUrl);

    const woff2Path = path.join(fontsDir, 'titan-one.woff2');
    const fileStream = fs.createWriteStream(woff2Path);
    https.get(fontUrl, (fontRes) => {
      fontRes.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Successfully saved ${woff2Path} (${fs.statSync(woff2Path).size} bytes)`);
      });
    }).on('error', err => {
      console.error('Error downloading woff2:', err);
    });
  });
}).on('error', err => {
  console.error('Error fetching Google Fonts CSS:', err);
});

