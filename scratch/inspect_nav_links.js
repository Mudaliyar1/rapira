const puppeteer = require('puppeteer');

async function inspect() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  await page.click('.navbar-toggler');
  await new Promise(r => setTimeout(r, 500));

  const details = await page.evaluate(() => {
    const navLinks = Array.from(document.querySelectorAll('#navbarMain .nav-link'));
    return navLinks.map(link => {
      const s = window.getComputedStyle(link);
      const after = window.getComputedStyle(link, '::after');
      const rect = link.getBoundingClientRect();
      return {
        text: link.innerText.trim(),
        display: s.display,
        justifyContent: s.justifyContent,
        alignItems: s.alignItems,
        textAlign: s.textAlign,
        textDecoration: s.textDecoration,
        width: rect.width,
        afterContent: after.content,
        afterMarginLeft: after.marginLeft,
        afterBorderTop: after.borderTopWidth
      };
    });
  });

  console.log(JSON.stringify(details, null, 2));
  await browser.close();
}

inspect().catch(console.error);

