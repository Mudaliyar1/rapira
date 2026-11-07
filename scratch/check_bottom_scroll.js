const puppeteer = require('puppeteer');

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

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await new Promise(r => setTimeout(r, 500));

  const info = await page.evaluate(() => {
    const f = document.querySelector('footer.rapira-site-footer');
    const bottomBar = f ? f.querySelector('.footer-bottom-bar') : null;
    const stickyBar = document.getElementById('mobileStickyBar');
    return {
      scrollY: window.scrollY,
      maxScrollY: document.documentElement.scrollHeight - window.innerHeight,
      footerRect: f ? f.getBoundingClientRect() : null,
      bottomBarRect: bottomBar ? bottomBar.getBoundingClientRect() : null,
      stickyBarRect: stickyBar ? stickyBar.getBoundingClientRect() : null
    };
  });
  console.log('Scroll Info:', JSON.stringify(info, null, 2));
  await browser.close();
})();

