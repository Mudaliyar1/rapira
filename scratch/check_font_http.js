const http = require('http');

function checkFont(urlPath) {
  return new Promise((resolve) => {
    http.get('http://127.0.0.1:3000' + urlPath, (res) => {
      console.log(`GET ${urlPath} -> status ${res.statusCode}, content-type: ${res.headers['content-type']}, content-length: ${res.headers['content-length']}`);
      let bytes = 0;
      res.on('data', chunk => bytes += chunk.length);
      res.on('end', () => {
        console.log(`Received ${bytes} bytes`);
        resolve(res.statusCode === 200 && bytes > 0);
      });
    }).on('error', err => {
      console.error(`Error requesting ${urlPath}:`, err);
      resolve(false);
    });
  });
}

async function run() {
  await checkFont('/fonts/titan-one.woff2');
  await checkFont('/fonts/titan-one.ttf');
}

run();

