const puppeteer = require('puppeteer');

const pagesToTest = [
  { url: 'http://127.0.0.1:3000/', name: 'Homepage' },
  { url: 'http://127.0.0.1:3000/artists', name: 'Artists Directory' },
  { url: 'http://127.0.0.1:3000/concerts', name: 'Concerts Page' },
  { url: 'http://127.0.0.1:3000/content', name: 'Content Library' },
  { url: 'http://127.0.0.1:3000/reels', name: 'Reels Page' },
  { url: 'http://127.0.0.1:3000/auth/login', name: 'Login Page' }
];

async function checkPages() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const p of pagesToTest) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const res = await page.goto(p.url, { waitUntil: 'networkidle2' });
    const status = res.status();

    const pageInfo = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const h2 = document.querySelector('h2');
      const docScrollWidth = document.documentElement.scrollWidth;
      const winInnerWidth = window.innerWidth;
      const isTitanLoaded = document.fonts.check('1em "Titan One"');

      return {
        h1Text: h1 ? h1.innerText.substring(0, 40) : null,
        h1Font: h1 ? window.getComputedStyle(h1).fontFamily : null,
        h2Text: h2 ? h2.innerText.substring(0, 40) : null,
        h2Font: h2 ? window.getComputedStyle(h2).fontFamily : null,
        hasOverflow: docScrollWidth > winInnerWidth,
        isTitanLoaded
      };
    });

    console.log(`\nPage: ${p.name} (${p.url}) -> Status ${status}`);
    console.log(` - Titan One loaded: ${pageInfo.isTitanLoaded}`);
    console.log(` - h1: "${pageInfo.h1Text}" -> font: ${pageInfo.h1Font}`);
    console.log(` - Overflow: ${pageInfo.hasOverflow}`);
    console.log(` - Errors: ${errors.length > 0 ? errors.join(', ') : 'None'}`);

    await page.close();
  }

  await browser.close();
}

checkPages().catch(console.error);

