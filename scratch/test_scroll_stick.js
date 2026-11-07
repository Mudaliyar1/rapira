const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 950 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  
  const before = await page.evaluate(() => {
    const el = document.getElementById('homeArtistsContainer');
    el.scrollLeft = 280;
    return el.scrollLeft;
  });
  console.log('Immediate scrollLeft:', before);

  await new Promise(r => setTimeout(r, 200));

  const after = await page.evaluate(() => {
    return document.getElementById('homeArtistsContainer').scrollLeft;
  });
  console.log('After 200ms scrollLeft:', after);

  await browser.close();
})();

