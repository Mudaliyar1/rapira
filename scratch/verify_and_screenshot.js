const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

async function runVerification() {
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

  const results = {};

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

    // Wait for fonts to be ready
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const metrics = await page.evaluate(() => {
      const headline = document.querySelector('.rh-hero-headline');
      const chunks = Array.from(document.querySelectorAll('.rh-headline-chunk')).map(c => ({
        text: c.innerText.trim(),
        rect: c.getBoundingClientRect(),
        display: window.getComputedStyle(c).display
      }));
      const headlineWrap = document.querySelector('.rh-hero-headline-wrap');
      const subRow = document.querySelector('.rh-hero-sub-row');
      const taglineWrap = document.querySelector('.rh-hero-tagline-wrap');
      const ctaGroup = document.querySelector('.rh-hero-cta-group');
      const navbarBrandSpan = document.querySelector('.navbar-brand span');
      const body = document.body;

      const cs = window.getComputedStyle(headline);
      const rect = headline.getBoundingClientRect();
      const wrapCs = window.getComputedStyle(headlineWrap);
      const subCs = window.getComputedStyle(subRow);
      const taglineCs = window.getComputedStyle(taglineWrap);
      const ctaCs = window.getComputedStyle(ctaGroup);
      const brandCs = navbarBrandSpan ? window.getComputedStyle(navbarBrandSpan) : null;
      const bodyCs = window.getComputedStyle(body);

      // Check whether chunks share the same vertical offset (top)
      const sameLine = chunks.length >= 2 ? Math.abs(chunks[0].rect.top - chunks[1].rect.top) < 5 : true;

      return {
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        headlineWidth: rect.width,
        headlineHeight: rect.height,
        chunks,
        sameLine,
        wrapPadding: wrapCs.padding,
        wrapMarginBottom: wrapCs.marginBottom,
        subRowMarginTop: subCs.marginTop,
        subRowMarginBottom: subCs.marginBottom,
        taglineMarginBottom: taglineCs.marginBottom,
        ctaMarginTop: ctaCs.marginTop,
        brandFontFamily: brandCs ? brandCs.fontFamily : 'none',
        bodyFontFamily: bodyCs.fontFamily,
        scrollWidth: document.documentElement.scrollWidth,
        windowWidth: window.innerWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
      };
    });

    results[vp.name] = metrics;

    // Capture screenshots
    // 1. Hero area screenshot
    const heroSection = await page.$('.rh-hero-section');
    if (heroSection) {
      await heroSection.screenshot({
        path: path.join(ARTIFACT_DIR, `refined-hero-${vp.name}.png`)
      });
    }

    // 2. Headline detail screenshot
    const headlineElem = await page.$('.rh-hero-headline-wrap');
    if (headlineElem) {
      await headlineElem.screenshot({
        path: path.join(ARTIFACT_DIR, `refined-headline-${vp.name}.png`)
      });
    }
  }

  // Also capture complete above-the-fold desktop & mobile viewports
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'refined-homepage-desktop-1440.png') });

  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'refined-homepage-mobile-375.png') });

  console.log('=== VERIFICATION RESULTS ===');
  console.log(JSON.stringify(results, null, 2));

  await browser.close();
}

runVerification().catch(console.error);

