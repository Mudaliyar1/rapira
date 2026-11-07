const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  // Open a reel
  await page.evaluate(() => {
    const c = document.querySelector('.rh-reel-card');
    if (c) c.click();
  });
  await new Promise(r => setTimeout(r, 800));

  const afterOpen = await page.evaluate(() => {
    const modal = document.getElementById('rhReelModal');
    return {
      modalDisplay: modal ? modal.style.display : 'none',
      hash: window.location.hash,
      bodyHasModalClass: document.body.classList.contains('rh-modal-open')
    };
  });
  console.log('After Open:', afterOpen);

  // Press browser Back
  console.log('Pressing browser Back...');
  await page.goBack();
  await new Promise(r => setTimeout(r, 800));

  const afterBack = await page.evaluate(() => {
    const modal = document.getElementById('rhReelModal');
    const overlay = document.getElementById('loading-overlay');
    return {
      modalDisplay: modal ? modal.style.display : 'none',
      overlayActive: overlay ? overlay.classList.contains('active') : false,
      hash: window.location.hash,
      bodyHasModalClass: document.body.classList.contains('rh-modal-open'),
      scrollY: window.scrollY
    };
  });
  console.log('After Browser Back:', afterBack);

  await browser.close();
})();

