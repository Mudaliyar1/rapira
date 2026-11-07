const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setCookie({
    name: 'rapira.sid',
    value: '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f',
    domain: 'localhost',
    path: '/'
  });
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://localhost:3000/concerts/6aec50df716ae22e5aa1797f/select-quantity?step=seats&quantity=2', { waitUntil: 'networkidle2' });

  await page.evaluate(() => {
    const f = document.querySelector('footer.rapira-site-footer');
    if (f) f.scrollIntoView({ block: 'end' });
  });
  await new Promise(r => setTimeout(r, 600));

  const shot = path.join(ARTIFACT_DIR, 'seat-selection-footer-clear-375px.png');
  await page.screenshot({ path: shot, fullPage: false });
  console.log('Saved footer shot:', shot);
  await browser.close();
})();

