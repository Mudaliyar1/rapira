const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  const textWidths = await page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll('.rh-card-title')).map(t => ({
      text: t.innerText,
      scrollWidth: t.scrollWidth,
      offsetWidth: t.offsetWidth,
      fontSize: window.getComputedStyle(t).fontSize
    }));
    const descs = Array.from(document.querySelectorAll('.rh-card-desc')).map(d => ({
      scrollWidth: d.scrollWidth,
      offsetWidth: d.offsetWidth,
      height: d.offsetHeight
    }));
    const cards = Array.from(document.querySelectorAll('.rh-how-card')).map(c => ({
      cardWidth: c.offsetWidth,
      cardHeight: c.offsetHeight
    }));
    return { titles, descs, cards };
  });

  console.log(JSON.stringify(textWidths, null, 2));
  await browser.close();
})();

