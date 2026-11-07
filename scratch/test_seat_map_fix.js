const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');
const fs = require('fs');

(async () => {
  const tmpDir = path.join(os.tmpdir(), 'puppeteer_test_' + Date.now());
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    userDataDir: tmpDir
  });
  try {
    const page = await browser.newPage();
    await page.setCookie({
      name: 'rapira.sid',
      value: '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f',
      domain: 'localhost',
      path: '/'
    });
    await page.setViewport({ width: 375, height: 812 });
    await page.goto('http://localhost:3000/concerts/6aec50df716ae22e5aa1797f/select-quantity?step=seats&quantity=2', { waitUntil: 'networkidle2' });

    const initial = await page.evaluate(() => {
      const vp = document.getElementById('seatMapViewport');
      const content = document.getElementById('seatMapContent');
      const vpRect = vp ? vp.getBoundingClientRect() : null;
      const cRect = content ? content.getBoundingClientRect() : null;
      return {
        vpRect: vpRect ? { width: Math.round(vpRect.width), left: Math.round(vpRect.left), right: Math.round(vpRect.right) } : null,
        cRect: cRect ? { width: Math.round(cRect.width), left: Math.round(cRect.left), right: Math.round(cRect.right) } : null,
        vpScrollWidth: vp ? vp.scrollWidth : null,
        vpClientWidth: vp ? vp.clientWidth : null,
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        winInnerWidth: window.innerWidth
      };
    });
    console.log('Initial State:', JSON.stringify(initial, null, 2));

  } finally {
    await browser.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
})();
