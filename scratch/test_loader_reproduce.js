const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  // Check initial overlay state
  const initialOverlay = await page.evaluate(() => {
    const o = document.getElementById('loading-overlay');
    return { exists: !!o, active: o ? o.classList.contains('active') : false };
  });
  console.log('Initial overlay:', initialOverlay);

  // Click card to open reel
  await page.evaluate(() => {
    const c = document.querySelector('.rh-reel-card');
    if (c) c.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const afterOpenOverlay = await page.evaluate(() => {
    const o = document.getElementById('loading-overlay');
    const modal = document.getElementById('rhReelModal');
    return {
      modalDisplay: modal ? modal.style.display : 'none',
      overlayActive: o ? o.classList.contains('active') : false
    };
  });
  console.log('After open reel:', afterOpenOverlay);

  // Click close button
  await page.evaluate(() => {
    const btn = document.querySelector('.rh-reel-modal-close');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const afterCloseOverlay = await page.evaluate(() => {
    const o = document.getElementById('loading-overlay');
    const modal = document.getElementById('rhReelModal');
    const text = document.getElementById('loading-text');
    return {
      modalDisplay: modal ? modal.style.display : 'none',
      overlayActive: o ? o.classList.contains('active') : false,
      loadingText: text ? text.textContent : null
    };
  });
  console.log('After close button click:', afterCloseOverlay);

  await browser.close();
})();

