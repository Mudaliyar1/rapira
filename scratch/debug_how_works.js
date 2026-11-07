const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  await page.evaluate(() => {
    const el = document.querySelector('.rh-how-works-section');
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await new Promise(r => setTimeout(r, 1000));

  const section = await page.$('.rh-how-works-section');
  if (section) {
    await section.screenshot({
      path: path.join(ARTIFACT_DIR, 'debug-how-works-mobile-before.png')
    });
  }

  // Also inspect metrics of card 1, card 2, card 3
  const cardsInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.rh-how-card')).map((c, i) => {
      const art = c.querySelector('.rh-card-art');
      const img = c.querySelector('.rh-art-img');
      const content = c.querySelector('.rh-card-content');
      const title = c.querySelector('.rh-card-title');
      const desc = c.querySelector('.rh-card-desc');
      return {
        cardIndex: i,
        cardRect: c.getBoundingClientRect(),
        contentRect: content ? content.getBoundingClientRect() : null,
        artRect: art ? art.getBoundingClientRect() : null,
        imgRect: img ? img.getBoundingClientRect() : null,
        titleText: title ? title.innerText : null
      };
    });
  });

  console.log('How Works Mobile Metrics:', JSON.stringify(cardsInfo, null, 2));

  await browser.close();
})();
