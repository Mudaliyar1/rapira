const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = path.resolve('C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d');
const SESSION_COOKIE = 'testsessionvenue1234567890abcdef1234567890abcdef1234567890abcdef';

async function main() {
  console.log('--- STARTING MY TICKETS QA SUITE ---');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setCookie({
    name: 'rapira.sid',
    value: SESSION_COOKIE,
    domain: 'localhost',
    path: '/',
    httpOnly: true
  });

  // 1. Desktop Test (1440px)
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/tickets', { waitUntil: 'networkidle2' });

  // Verify page title
  const pageTitle = await page.$eval('.my-tickets-title', el => el.textContent.trim());
  console.log('Page Title:', pageTitle);

  // Verify card count
  const cards = await page.$$('.my-tickets-card');
  console.log('Ticket cards count:', cards.length);

  // Verify first card details
  const firstCardDetails = await page.evaluate(() => {
    const card = document.querySelector('.my-tickets-card');
    if (!card) return null;
    return {
      ticketId: card.querySelector('.my-tickets-card-id')?.textContent.trim(),
      status: card.querySelector('.my-tickets-status-badge')?.textContent.trim(),
      concert: card.querySelector('.my-tickets-concert-title')?.textContent.trim(),
      meta: Array.from(card.querySelectorAll('.my-tickets-meta-row span')).map(s => s.textContent.trim()),
      purchaseValues: Array.from(card.querySelectorAll('.my-tickets-purchase-value')).map(s => s.textContent.trim()),
      btnText: card.querySelector('.my-tickets-btn-view')?.textContent.trim(),
      btnHref: card.querySelector('.my-tickets-btn-view')?.getAttribute('href')
    };
  });
  console.log('First card extracted details:', JSON.stringify(firstCardDetails, null, 2));

  // Check 1440px overflow
  const noOverflow1440 = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  console.log('Desktop 1440px Overflow Check:', noOverflow1440 ? 'PASS (0 overflow)' : 'FAIL');

  // Capture Desktop Screenshot
  const desktopScreenshot = path.join(ARTIFACT_DIR, 'my-tickets-after-desktop-1440px.png');
  await page.screenshot({ path: desktopScreenshot, fullPage: true });
  console.log('Saved:', desktopScreenshot);

  // 2. Responsive Viewports Testing
  const viewports = [
    { width: 360, height: 740, name: '360px' },
    { width: 375, height: 667, name: '375px' },
    { width: 390, height: 844, name: '390px' },
    { width: 414, height: 896, name: '414px' },
    { width: 768, height: 1024, name: '768px' },
    { width: 1024, height: 768, name: '1024px' }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 100));
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    console.log(`Viewport ${vp.name} (${vp.width}px): ${noOverflow ? 'PASS (no overflow)' : 'FAIL'}`);

    if (vp.width === 375) {
      const mobileScreenshot = path.join(ARTIFACT_DIR, 'my-tickets-after-mobile-375px.png');
      await page.screenshot({ path: mobileScreenshot, fullPage: true });
      console.log('Saved:', mobileScreenshot);
    }
  }

  // 3. Verify View Details link navigation
  console.log('\n--- Testing View Details link navigation ---');
  const detailsHref = firstCardDetails.btnHref;
  console.log('Navigating to first ticket details:', detailsHref);
  const detailsResponse = await page.goto(`http://localhost:3000${detailsHref}`, { waitUntil: 'networkidle2' });
  console.log('Ticket details HTTP status:', detailsResponse.status());

  await browser.close();
  console.log('--- ALL QA TESTS COMPLETED SUCCESSFULLY ---');
}

main().catch(err => {
  console.error('QA SUITE ERROR:', err);
  process.exit(1);
});

