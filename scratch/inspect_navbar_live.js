const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));

  const navElements = await page.evaluate(() => {
    const nav = document.querySelector('.navbar');
    if (!nav) return 'no navbar';
    const allLinks = Array.from(nav.querySelectorAll('a, button, div, span, i'));
    const items = allLinks.map(el => ({
      tag: el.tagName,
      className: el.className,
      id: el.id,
      text: el.innerText.trim(),
      href: el.getAttribute('href'),
      html: el.outerHTML.substring(0, 150)
    }));
    return {
      navHtml: nav.outerHTML,
      items: items.filter(it => it.text.includes('Login') || it.text.includes('Register') || it.className.includes('search') || it.html.includes('search'))
    };
  });

  console.log('Filtered items:', JSON.stringify(navElements.items, null, 2));
  await browser.close();
})();

