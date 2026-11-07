const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');

(async () => {
  const tmpDir = path.join(os.tmpdir(), 'pup_tmp_' + Date.now());
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tmpDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  const info = await page.evaluate(() => {
    const pag = document.getElementById('howWorksPagination');
    const dots = Array.from(document.querySelectorAll('.rh-how-dot'));
    const btn = document.querySelector('.rh-cta-action-btn');
    const action = document.querySelector('.rh-artist-cta-action');
    const card = document.querySelector('.rh-artist-cta-card');

    return {
      pagination: pag ? {
        outerHTML: pag.outerHTML,
        computedDisplay: window.getComputedStyle(pag).display,
        flexDirection: window.getComputedStyle(pag).flexDirection,
        justifyContent: window.getComputedStyle(pag).justifyContent,
        alignItems: window.getComputedStyle(pag).alignItems,
        width: window.getComputedStyle(pag).width,
        rect: pag.getBoundingClientRect()
      } : null,
      dots: dots.map(d => ({
        className: d.className,
        rect: d.getBoundingClientRect(),
        display: window.getComputedStyle(d).display,
        width: window.getComputedStyle(d).width,
        height: window.getComputedStyle(d).height,
        backgroundColor: window.getComputedStyle(d).backgroundColor
      })),
      artistCta: action ? {
        display: window.getComputedStyle(action).display,
        justifyContent: window.getComputedStyle(action).justifyContent,
        rect: action.getBoundingClientRect(),
        cardRect: card ? card.getBoundingClientRect() : null,
        btnRect: btn ? btn.getBoundingClientRect() : null,
        btnAlignSelf: btn ? window.getComputedStyle(btn).alignSelf : null,
        btnMargin: btn ? window.getComputedStyle(btn).margin : null
      } : null
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();

