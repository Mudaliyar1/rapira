const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Tablet 768px
  await page.setViewport({ width: 768, height: 1024 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  const tabletCard3 = await page.$('.rh-card-experience');
  if (tabletCard3) {
    await tabletCard3.screenshot({
      path: path.join(ARTIFACTS_DIR, 'current-card3-tablet-768px.png')
    });
  }

  // Desktop 1440px
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  const desktopCard3 = await page.$('.rh-card-experience');
  if (desktopCard3) {
    await desktopCard3.screenshot({
      path: path.join(ARTIFACTS_DIR, 'current-card3-desktop-1440px.png')
    });
  }

  await browser.close();
})();

