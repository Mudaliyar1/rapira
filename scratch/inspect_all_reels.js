const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Listen to network failures and console
  page.on('response', resp => {
    if (resp.url().includes('cloudinary') || resp.url().includes('default-thumbnail') || resp.url().includes('images')) {
      console.log('HTTP', resp.status(), resp.url().substring(0, 80));
    }
  });

  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  const allCards = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.rh-reel-card'));
    return cards.map((c, i) => {
      const img = c.querySelector('img.rh-reel-media');
      const video = c.querySelector('video.rh-reel-media');
      const fallback = c.querySelector('.rh-reel-fallback');
      return {
        index: i,
        hasImg: !!img,
        imgSrc: img ? img.src : null,
        imgCurrentSrc: img ? img.currentSrc : null,
        imgNaturalWidth: img ? img.naturalWidth : null,
        imgNaturalHeight: img ? img.naturalHeight : null,
        imgComplete: img ? img.complete : null,
        hasVideo: !!video,
        hasFallback: !!fallback,
        innerText: c.innerText
      };
    });
  });

  console.log(JSON.stringify(allCards, null, 2));

  await browser.close();
})();

