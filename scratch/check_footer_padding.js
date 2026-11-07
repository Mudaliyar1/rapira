const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://localhost:3000/concerts/6aec50df716ae22e5aa1797f/select-quantity?step=seats&quantity=2', { waitUntil: 'networkidle2' });

  const footerPadding = await page.evaluate(() => {
    const f = document.querySelector('footer.rapira-site-footer');
    if (!f) return null;
    const computed = window.getComputedStyle(f);
    return {
      paddingBottom: computed.paddingBottom,
      paddingTop: computed.paddingTop,
      offsetHeight: f.offsetHeight,
      scrollHeight: f.scrollHeight,
      classList: Array.from(f.classList)
    };
  });
  console.log('Footer Padding Info:', footerPadding);
  await browser.close();
})();

