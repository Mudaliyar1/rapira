const http = require('http');

http.get('http://localhost:3000/concerts/6aec50df716ae22e5aa1797f', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const idx = data.indexOf('Open in Google Maps');
    if (idx !== -1) {
      console.log('Snippet around Open in Google Maps:\n', data.substring(idx - 350, idx + 100));
    } else {
      console.log('Not found');
    }
  });
});
