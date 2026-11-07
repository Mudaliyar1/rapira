const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  const brandInfo = await page.evaluate(() => {
    const brand = document.querySelector('.navbar-brand');
    const span = document.querySelector('.navbar-brand span');
    const html = brand ? brand.outerHTML : 'none';
    const computedSpan = span ? window.getComputedStyle(span).fontFamily : 'none';
    return { html, computedSpan };
  });

  console.log(JSON.stringify(brandInfo, null, 2));
  await browser.close();
})();

