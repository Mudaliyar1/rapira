const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  console.log('Waiting for openRapiraReelCard to be defined...');
  await page.waitForFunction(() => typeof window.openRapiraReelCard === 'function', { timeout: 10000 });
  console.log('openRapiraReelCard is ready!');

  // Now click the card
  await page.evaluate(() => {
    const card = document.querySelector('.rh-reel-card');
    card.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const state = await page.evaluate(() => {
    const modal = document.getElementById('rhReelModal');
    const nav = document.querySelector('.navbar');
    return {
      bodyHasClass: document.body.classList.contains('rh-modal-open'),
      modalDisplay: modal ? modal.style.display : null,
      navDisplay: nav ? window.getComputedStyle(nav).display : null,
      authorName: document.getElementById('rhReelAuthorName')?.textContent,
      caption: document.getElementById('rhReelCaption')?.textContent?.substring(0, 40)
    };
  });
  console.log('Result after waiting for function:', state);

  await browser.close();
}

test().catch(console.error);

