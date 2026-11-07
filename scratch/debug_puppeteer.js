const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });
    console.log('Browser launched successfully!');
    await browser.close();
  } catch (err) {
    console.error('Launch failed with error:', err);
  }
})();

