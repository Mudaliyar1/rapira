const http = require('http');

http.get('http://127.0.0.1:3000/posts/69ac0d9c644beff6e1b4f2b3/json', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Post details:', data);
  });
});

