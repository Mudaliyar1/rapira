const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  page.on('response', resp => {
    if (resp.url().includes('cloudinary') || resp.url().includes('default-thumbnail') || resp.url().includes('jpg') || resp.url().includes('png')) {
      console.log('HTTP', resp.status(), resp.url());
    }
  });

  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  // Scroll to #homeReelsContainer
  await page.evaluate(() => {
    const el = document.getElementById('homeReelsContainer');
    if (el) el.scrollIntoView();
  });

  // Wait a bit for lazy-loaded images or network
  await new Promise(r => setTimeout(r, 2000));

  const cards = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.rh-reel-card')).map((c, i) => {
      const img = c.querySelector('img.rh-reel-media');
      return {
        index: i,
        imgSrc: img ? img.src : null,
        imgNaturalWidth: img ? img.naturalWidth : null,
        imgComplete: img ? img.complete : null
      };
    });
  });

  console.log('Cards after scroll:');
  console.log(JSON.stringify(cards, null, 2));

  await browser.close();
})();

