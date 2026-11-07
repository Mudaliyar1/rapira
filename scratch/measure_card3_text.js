const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });

  const textMetrics = await page.evaluate(() => {
    const card = document.querySelector('.rh-card-experience');
    const title = card ? card.querySelector('.rh-card-title') : null;
    const desc = card ? card.querySelector('.rh-card-desc') : null;
    const btn = card ? card.querySelector('.rh-card-cta-btn') : null;
    const inner = card ? card.querySelector('.rh-how-card-inner') : null;
    const content = card ? card.querySelector('.rh-card-content') : null;

    return {
      innerRect: inner ? inner.getBoundingClientRect().toJSON() : null,
      contentRect: content ? content.getBoundingClientRect().toJSON() : null,
      titleRect: title ? title.getBoundingClientRect().toJSON() : null,
      titleScrollWidth: title ? title.scrollWidth : 0,
      descScrollWidth: desc ? desc.scrollWidth : 0,
      btnRect: btn ? btn.getBoundingClientRect().toJSON() : null
    };
  });

  console.log('Text metrics for Card 3:', textMetrics);
  await browser.close();
})();

