const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  const data = await page.evaluate(() => {
    const c = document.querySelector('.rh-how-card');
    const content = c.querySelector('.rh-card-content');
    const art = c.querySelector('.rh-card-art');
    const img = c.querySelector('.rh-art-img');
    const desc = c.querySelector('.rh-card-desc');
    function r(el) {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) };
    }
    return { card: r(c), content: r(content), desc: r(desc), art: r(art), img: r(img) };
  });

  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();

