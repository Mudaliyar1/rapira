const puppeteer = require('puppeteer');

async function testResponsive() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const viewports = [
    { width: 360, height: 740, name: '360px' },
    { width: 375, height: 812, name: '375px' },
    { width: 390, height: 844, name: '390px' },
    { width: 414, height: 896, name: '414px' },
    { width: 768, height: 1024, name: '768px' },
    { width: 1024, height: 768, name: '1024px' },
    { width: 1440, height: 900, name: '1440px' }
  ];

  for (const vp of viewports) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

    const metrics = await page.evaluate(() => {
      const hero = document.querySelector('.rh-hero-headline');
      const wrap = document.querySelector('.rh-hero-headline-wrap');
      const stamp = document.querySelector('.rh-hero-stamp');
      const howHeadline = document.querySelector('.rh-how-headline');
      const ctaHeadline = document.querySelector('.rh-artist-cta-title');
      const sectionTitles = Array.from(document.querySelectorAll('.rh-section-title'));

      const heroRect = hero ? hero.getBoundingClientRect() : null;
      const wrapRect = wrap ? wrap.getBoundingClientRect() : null;
      const stampRect = stamp ? stamp.getBoundingClientRect() : null;

      // Check horizontal overflow
      const docScrollWidth = document.documentElement.scrollWidth;
      const winInnerWidth = window.innerWidth;
      const hasHorizontalScroll = docScrollWidth > winInnerWidth;

      // Check hero wrapping
      const heroLines = hero ? hero.innerText.split('\n') : [];

      return {
        hasHorizontalScroll,
        docScrollWidth,
        winInnerWidth,
        heroRect: heroRect ? { width: heroRect.width, height: heroRect.height, left: heroRect.left, right: heroRect.right } : null,
        wrapRect: wrapRect ? { width: wrapRect.width } : null,
        heroClipped: heroRect ? (heroRect.left < 0 || heroRect.right > winInnerWidth) : false,
        heroText: hero ? hero.innerText : '',
        howHeadlineWidth: howHeadline ? howHeadline.getBoundingClientRect().width : null,
        ctaHeadlineWidth: ctaHeadline ? ctaHeadline.getBoundingClientRect().width : null,
        sectionTitlesOverflow: sectionTitles.some(st => st.getBoundingClientRect().right > winInnerWidth)
      };
    });

    console.log(`\nViewport ${vp.name}:`);
    console.log(` - Horizontal scroll: ${metrics.hasHorizontalScroll} (${metrics.docScrollWidth}px vs ${metrics.winInnerWidth}px)`);
    console.log(` - Hero headline width: ${metrics.heroRect?.width}px, height: ${metrics.heroRect?.height}px, clipped: ${metrics.heroClipped}`);
    console.log(` - Section titles overflow: ${metrics.sectionTitlesOverflow}`);

    await page.close();
  }

  await browser.close();
}

testResponsive().catch(console.error);

