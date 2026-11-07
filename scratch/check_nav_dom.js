const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  const navInfo = await page.evaluate(() => {
    const nav = document.querySelector('nav.navbar') || document.querySelector('.navbar');
    return {
      outerHTML: nav ? nav.outerHTML : 'no nav found'
    };
  });

  console.log(navInfo.outerHTML);
  await browser.close();
})();

