const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));

  const slidesInfo = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('#mainCarousel .carousel-item'));
    return items.map((item, idx) => {
      const img = item.querySelector('img');
      const a = item.querySelector('a');
      const caption = item.querySelector('.carousel-caption');
      return {
        index: idx,
        active: item.classList.contains('active'),
        imgSrc: img ? img.getAttribute('src') : null,
        naturalWidth: img ? img.naturalWidth : null,
        naturalHeight: img ? img.naturalHeight : null,
        renderedWidth: img ? img.clientWidth : null,
        renderedHeight: img ? img.clientHeight : null,
        computedFit: img ? window.getComputedStyle(img).objectFit : null,
        computedPosition: img ? window.getComputedStyle(img).objectPosition : null,
        captionText: caption ? caption.innerText.trim() : null
      };
    });
  });

  console.log('Slides in mainCarousel:', JSON.stringify(slidesInfo, null, 2));
  await browser.close();
})();

