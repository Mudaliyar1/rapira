const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 950, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  const trackEl = await page.$('#howWorksTrack');
  
  // Set scrollLeft
  const scrollResult = await page.evaluate(() => {
    const t = document.getElementById('howWorksTrack');
    t.scrollLeft = 295;
    return {
      scrollLeft: t.scrollLeft,
      card0Left: t.children[0].getBoundingClientRect().left,
      card1Left: t.children[1].getBoundingClientRect().left
    };
  });
  console.log('scrollResult:', scrollResult);

  await new Promise(r => setTimeout(r, 300));

  // Take screenshot of #howWorksTrack element directly
  if (trackEl) {
    await trackEl.screenshot({
      path: path.join('C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d', 'scratch', 'track_test.png')
    });
  }

  await browser.close();
})();

