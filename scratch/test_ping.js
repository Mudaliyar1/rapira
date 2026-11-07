const http = require('http');

http.get('http://127.0.0.1:3000/', (res) => {
  console.log('Server status:', res.statusCode);
}).on('error', (e) => {
  console.error('Server error:', e.message);
});

