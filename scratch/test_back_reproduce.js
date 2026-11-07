const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Navigate to /concerts first, then to /
  await page.goto('http://127.0.0.1:3000/concerts', { waitUntil: 'networkidle2' });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  // Open a reel
  await page.evaluate(() => {
    const c = document.querySelector('.rh-reel-card');
    if (c) c.click();
  });
  await new Promise(r => setTimeout(r, 600));

  console.log('Reel opened. Now pressing browser Back...');
  await page.goBack();
  await new Promise(r => setTimeout(r, 1000));

  const backState = await page.evaluate(() => {
    const o = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    return {
      url: window.location.href,
      overlayActive: o ? o.classList.contains('active') : false,
      loadingText: text ? text.textContent : null,
      bodyHasModalClass: document.body.classList.contains('rh-modal-open')
    };
  });
  console.log('After Browser Back State:', backState);

  await browser.close();
})();

