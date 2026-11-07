const puppeteer = require('puppeteer');

async function inspectHero() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 812 }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

    const metrics = await page.evaluate(() => {
      const headline = document.querySelector('.rh-hero-headline');
      const headlineWrap = document.querySelector('.rh-hero-headline-wrap');
      const subRow = document.querySelector('.rh-hero-sub-row');
      const taglineWrap = document.querySelector('.rh-hero-tagline-wrap');
      const ctaGroup = document.querySelector('.rh-hero-cta-group');
      const navbarBrand = document.querySelector('.navbar-brand');

      if (!headline) return { error: 'Headline not found' };

      const cs = window.getComputedStyle(headline);
      const rect = headline.getBoundingClientRect();
      const wrapCs = window.getComputedStyle(headlineWrap);
      const subCs = window.getComputedStyle(subRow);
      const brandCs = navbarBrand ? window.getComputedStyle(navbarBrand) : null;

      // Calculate approximate lines
      const computedLineHeight = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.04);
      const lineCount = Math.round(rect.height / computedLineHeight);

      return {
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        width: rect.width,
        height: rect.height,
        lineCount,
        wrapPadding: wrapCs.padding,
        subRowMarginTop: subCs.marginTop,
        subRowMarginBottom: subCs.marginBottom,
        brandFontFamily: brandCs ? brandCs.fontFamily : 'none',
        scrollWidth: document.documentElement.scrollWidth,
        windowWidth: window.innerWidth
      };
    });

    console.log(`=== Viewport ${vp.name} (${vp.width}x${vp.height}) ===`);
    console.log(JSON.stringify(metrics, null, 2));
  }

  await browser.close();
}

inspectHero().catch(console.error);

