const puppeteer = require('puppeteer');

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Desktop 1440px
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/subscriptions', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d/subscriptions-baseline-desktop.png', fullPage: true });
  
  // Mobile 375px
  await page.setViewport({ width: 375, height: 812, isMobile: true });
  await page.goto('http://localhost:3000/subscriptions', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d/subscriptions-baseline-mobile.png', fullPage: true });

  await browser.close();
  console.log('Subscriptions baseline captured');
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});

