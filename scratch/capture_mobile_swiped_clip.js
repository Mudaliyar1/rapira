const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 950, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  const sectionRect = await page.evaluate(() => {
    const s = document.querySelector('.rh-how-works-section');
    const b = s.getBoundingClientRect();
    return {
      x: 0,
      y: Math.round(b.top),
      width: 375,
      height: Math.round(b.height)
    };
  });

  // 1. Capture Card 1 initial view
  await page.screenshot({
    path: path.join('C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d', 'how-rapira-works-mobile-card1.png'),
    clip: sectionRect
  });

  // 2. Scroll track to Card 2
  await page.evaluate(() => {
    const track = document.getElementById('howWorksTrack');
    if (track) {
      track.scrollLeft = 287;
      track.dispatchEvent(new Event('scroll'));
    }
  });
  await new Promise(r => setTimeout(r, 600));

  // Capture Card 2 swiped view
  await page.screenshot({
    path: path.join('C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d', 'how-rapira-works-mobile-card2.png'),
    clip: sectionRect
  });

  await browser.close();
  console.log('Successfully captured card1 and card2 mobile screenshots!');
})();
