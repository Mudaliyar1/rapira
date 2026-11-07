const http = require('http');

const req = http.get('http://127.0.0.1:3000/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('HTML size:', data.length);
  });
});
req.on('error', err => console.error('Full Error:', err));
