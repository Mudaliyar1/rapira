const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  // Test 1: page.click
  console.log('Testing page.click...');
  await page.click('.rh-reel-card');
  await new Promise(r => setTimeout(r, 400));
  let open1 = await page.evaluate(() => document.body.classList.contains('rh-modal-open'));
  console.log('Open after page.click:', open1);

  if (!open1) {
    // Test 2: evaluate click
    console.log('Testing evaluate click...');
    await page.evaluate(() => {
      const card = document.querySelector('.rh-reel-card');
      card.click();
    });
    await new Promise(r => setTimeout(r, 400));
    let open2 = await page.evaluate(() => document.body.classList.contains('rh-modal-open'));
    console.log('Open after evaluate click:', open2);
  }

  const finalState = await page.evaluate(() => {
    const modal = document.getElementById('rhReelModal');
    const nav = document.querySelector('.navbar');
    return {
      modalStyleDisplay: modal ? modal.style.display : null,
      navComputedDisplay: nav ? window.getComputedStyle(nav).display : null,
      authorName: document.getElementById('rhReelAuthorName')?.textContent,
      caption: document.getElementById('rhReelCaption')?.textContent?.substring(0, 40)
    };
  });
  console.log('Final state:', finalState);

  await browser.close();
}

test().catch(console.error);

