const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });

  const matched = await page.evaluate(() => {
    const btn = document.querySelector('.rh-btn-crimson-solid');
    const banner = document.querySelector('.rh-hero-banner-container');
    const getRules = (el) => {
      const res = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule.selectorText && el.matches(rule.selectorText)) {
              res.push({
                href: sheet.href ? sheet.href.split('/').pop() : 'inline',
                selector: rule.selectorText,
                cssText: rule.cssText
              });
            } else if (rule.cssRules) {
              for (const sub of rule.cssRules) {
                if (sub.selectorText && el.matches(sub.selectorText)) {
                  res.push({
                    href: sheet.href ? sheet.href.split('/').pop() : 'inline',
                    media: rule.conditionText || (rule.media ? rule.media.mediaText : ''),
                    selector: sub.selectorText,
                    cssText: sub.cssText
                  });
                }
              }
            }
          }
        } catch (e) {}
      }
      return res;
    };
    return {
      btnRules: getRules(btn),
      bannerRules: getRules(banner)
    };
  });

  console.log('BTN MATCHED RULES:', JSON.stringify(matched.btnRules, null, 2));
  console.log('BANNER MATCHED RULES:', JSON.stringify(matched.bannerRules, null, 2));

  await browser.close();
})();

