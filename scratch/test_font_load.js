const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  const fontStatus = await page.evaluate(async () => {
    const fonts = [];
    document.fonts.forEach(f => {
      fonts.push({
        family: f.family,
        status: f.status,
        weight: f.weight
      });
    });
    return fonts;
  });

  console.log('Current loaded fonts in browser:', fontStatus);

  await browser.close();
}

test().catch(console.error);

