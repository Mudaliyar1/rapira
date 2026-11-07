const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/concerts/6aec50df716ae22e5aa1797f/book',
  method: 'GET',
  headers: {
    'Cookie': 'rapira.sid=s%3A6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status code:', res.statusCode);
    const footerMatch = data.match(/<footer[^>]*>/i);
    console.log('Footer tag:', footerMatch ? footerMatch[0] : 'NOT FOUND');
    const navMatch = data.match(/<nav[^>]*>/i);
    console.log('Nav tag:', navMatch ? navMatch[0] : 'NOT FOUND');
    
    // Check if footer has rapira-homepage-footer or text-white
    if (footerMatch) {
      console.log('Footer classes:', footerMatch[0]);
    }
    
    // Check body class or attributes
    const bodyMatch = data.match(/<body[^>]*>/i);
    console.log('Body tag:', bodyMatch ? bodyMatch[0] : 'NOT FOUND');

    // Check main tag
    const mainMatch = data.match(/<main[^>]*>/i);
    console.log('Main tag:', mainMatch ? mainMatch[0] : 'NOT FOUND');
  });
});

req.on('error', (e) => console.error('Request error:', e));
req.end();

