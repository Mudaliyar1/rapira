const fs = require('fs');
try {
  require.resolve('puppeteer');
  console.log('Puppeteer is available');
} catch (e) {
  console.log('Puppeteer error:', e.message);
}

