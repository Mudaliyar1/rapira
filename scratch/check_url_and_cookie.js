const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/concerts/6aec50df716ae22e5aa1797f/select-quantity?step=seats&quantity=2', { waitUntil: 'networkidle2' });
  console.log('Without cookie URL:', page.url());

  await page.setCookie({
    name: 'rapira.sid',
    value: '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f',
    domain: 'localhost',
    path: '/'
  });
  await page.goto('http://localhost:3000/concerts/6aec50df716ae22e5aa1797f/select-quantity?step=seats&quantity=2', { waitUntil: 'networkidle2' });
  console.log('With cookie URL:', page.url());

  const paddingWithCookie = await page.evaluate(() => {
    const f = document.querySelector('footer.rapira-site-footer');
    return f ? window.getComputedStyle(f).paddingBottom : null;
  });
  console.log('Padding with cookie:', paddingWithCookie);

  await browser.close();
})();

