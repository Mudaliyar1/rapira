const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });

  const btnDetails = await page.evaluate(() => {
    const btn1 = document.querySelector('.rh-btn-crimson-solid');
    const btn2 = document.querySelector('.rh-btn-outline-pill');
    const cs1 = window.getComputedStyle(btn1);
    const cs2 = window.getComputedStyle(btn2);

    return {
      btn1: {
        tagName: btn1.tagName,
        className: btn1.className,
        bg: cs1.backgroundColor,
        color: cs1.color,
        border: cs1.border,
        boxShadow: cs1.boxShadow
      },
      btn2: {
        tagName: btn2.tagName,
        className: btn2.className,
        bg: cs2.backgroundColor,
        color: cs2.color,
        border: cs2.border
      }
    };
  });

  console.log('Button details (375px):', JSON.stringify(btnDetails, null, 2));

  // Now check 1440px carousel
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });

  const carouselDetails = await page.evaluate(() => {
    const banner = document.querySelector('.rh-hero-banner-container');
    const carousel = document.querySelector('#mainCarousel');
    const items = Array.from(document.querySelectorAll('.carousel-item'));
    return {
      banner: {
        height: banner.offsetHeight,
        computedHeight: window.getComputedStyle(banner).height,
        borderRadius: window.getComputedStyle(banner).borderRadius
      },
      carousel: {
        height: carousel.offsetHeight,
        computedHeight: window.getComputedStyle(carousel).height
      },
      itemHeights: items.map(it => it.offsetHeight)
    };
  });

  console.log('Carousel details (1440px):', JSON.stringify(carouselDetails, null, 2));

  await browser.close();
})();

