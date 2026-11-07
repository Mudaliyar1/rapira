const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  const positions = await page.evaluate(() => {
    const card = document.querySelector('.rh-reel-card');
    const img = card ? card.querySelector('img.rh-reel-media') : null;
    function serializeRect(r) {
      if (!r) return null;
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    }
    return {
      cardRect: serializeRect(card ? card.getBoundingClientRect() : null),
      imgRect: serializeRect(img ? img.getBoundingClientRect() : null)
    };
  });

  console.log(JSON.stringify(positions, null, 2));
  await browser.close();
})();
