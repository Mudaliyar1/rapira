const http = require('http');

http.get('http://127.0.0.1:3000/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const cardMatches = data.match(/class="rh-reel-card"/g);
    console.log('rh-reel-card count:', cardMatches ? cardMatches.length : 0);
    const mockMatches = data.match(/mock-\d+/g);
    console.log('mock reel references:', mockMatches ? mockMatches.length : 0);
    const idMatches = data.match(/openRapiraReel\('([^']+)'/g);
    console.log('openRapiraReel calls:', idMatches);
  });
}).on('error', err => console.error(err));

