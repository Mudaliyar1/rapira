const https = require('https');
const fs = require('fs');
const path = require('path');

const fontsDir = path.join(__dirname, '../public/fonts');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
      }
      const fileStream = fs.createWriteStream(dest);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Saved ${dest} (${fs.statSync(dest).size} bytes)`);
        resolve();
      });
    }).on('error', reject);
  });
}

async function run() {
  // 1. Download official OFL.txt license
  console.log('Downloading Titan One OFL license...');
  await download('https://raw.githubusercontent.com/google/fonts/main/ofl/titanone/OFL.txt', path.join(fontsDir, 'TitanOne-OFL.txt'));

  // 2. Download official complete TTF
  console.log('Downloading complete TitanOne-Regular.ttf...');
  await download('https://raw.githubusercontent.com/google/fonts/main/ofl/titanone/TitanOne-Regular.ttf', path.join(fontsDir, 'titan-one.ttf'));

  // 3. Download primary latin woff2 from Google Fonts CDN
  console.log('Downloading latin woff2 from fonts.gstatic.com...');
  await download('https://fonts.gstatic.com/s/titanone/v17/mFTzWbsGxbbS_J5cQcjClDgm.woff2', path.join(fontsDir, 'titan-one.woff2'));

  console.log('All Titan One font assets downloaded successfully!');
}

run().catch(console.error);

