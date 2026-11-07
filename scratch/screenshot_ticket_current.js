const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.setCookie({
    name: 'rapira.sid',
    value: '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f',
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false
  });

  await page.goto('http://localhost:3000/tickets/6aed6b3721b17fc127765f40', {
    waitUntil: 'networkidle2'
  });

  await page.screenshot({
    path: 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d/ticket-current-desktop.png',
    fullPage: true
  });

  console.log('Screenshot saved: ticket-current-desktop.png');
  await browser.close();
})();

