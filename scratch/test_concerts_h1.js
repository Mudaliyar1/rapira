const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000/concerts', { waitUntil: 'networkidle2' });

  const h1Info = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    return {
      text: h1 ? h1.innerText : null,
      font: h1 ? window.getComputedStyle(h1).fontFamily : null
    };
  });

  console.log('Concerts page h1:', h1Info);
  await browser.close();
}

test().catch(console.error);

