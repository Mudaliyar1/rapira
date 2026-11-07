const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://localhost:3000/concerts/6aec50df716ae22e5aa1797f/select-quantity?step=seats&quantity=2', { waitUntil: 'networkidle2' });

  const rules = await page.evaluate(() => {
    const f = document.querySelector('footer.rapira-site-footer');
    const matched = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText && f.matches(rule.selectorText) && rule.style.paddingBottom) {
            matched.push({
              href: sheet.href,
              selector: rule.selectorText,
              paddingBottom: rule.style.paddingBottom
            });
          }
        }
      } catch (e) {}
    }
    return matched;
  });
  console.log('Matched Rules:', rules);
  await browser.close();
})();

