const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const artifactDir = 'C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d';
const viewports = [360, 375, 390, 414, 768, 1440];

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const report = {};

  for (const width of viewports) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 950, deviceScaleFactor: 2 });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const metrics = await page.evaluate(() => {
      const getR = el => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return {
          top: Math.round(b.top * 10) / 10,
          bottom: Math.round(b.bottom * 10) / 10,
          left: Math.round(b.left * 10) / 10,
          right: Math.round(b.right * 10) / 10,
          width: Math.round(b.width * 10) / 10,
          height: Math.round(b.height * 10) / 10
        };
      };

      const doc = document.documentElement;
      const body = document.body;
      const hasHorizontalOverflow = doc.scrollWidth > window.innerWidth || body.scrollWidth > window.innerWidth;

      const headline = document.querySelector('.rh-hero-headline');
      const headlineRect = getR(headline);
      const headlineComputed = headline ? window.getComputedStyle(headline) : null;
      const headlineScrollWidth = headline ? headline.scrollWidth : 0;
      const headlineClientWidth = headline ? headline.clientWidth : 0;
      const headlineClipped = headlineScrollWidth > headlineClientWidth;

      const stamp = document.querySelector('.rh-hero-stamp');
      const stampRect = getR(stamp);

      const banner = document.querySelector('.rh-hero-banner-container');
      const bannerRect = getR(banner);

      const stampOverlap = (stampRect && bannerRect)
        ? (stampRect.bottom > bannerRect.top && stampRect.top < bannerRect.bottom)
        : false;
      const stampDistanceToBanner = (stampRect && bannerRect)
        ? Math.round((bannerRect.top - stampRect.bottom) * 10) / 10
        : null;

      const watermark = document.querySelector('.rh-cta-watermark');
      const ctaCard = document.querySelector('.rh-artist-cta-card');
      const ctaCardRect = getR(ctaCard);
      const ctaTitle = document.querySelector('.rh-artist-cta-title');
      const ctaTitleRect = getR(ctaTitle);
      const ctaDesc = document.querySelector('.rh-artist-cta-desc');
      const ctaDescRect = getR(ctaDesc);
      const ctaBtn = document.querySelector('.rh-cta-action-btn');
      const ctaBtnRect = getR(ctaBtn);

      const btnBelowDesc = (ctaDescRect && ctaBtnRect)
        ? (ctaBtnRect.top >= ctaDescRect.bottom - 2)
        : false;
      const btnHref = ctaBtn ? ctaBtn.getAttribute('href') : null;

      return {
        viewportWidth: window.innerWidth,
        hasHorizontalOverflow,
        scrollWidth: doc.scrollWidth,
        headline: {
          text: headline ? headline.innerText.replace(/\s+/g, ' ').trim() : null,
          fontSize: headlineComputed ? headlineComputed.fontSize : null,
          lineHeight: headlineComputed ? headlineComputed.lineHeight : null,
          rect: headlineRect,
          isClipped: headlineClipped,
          withinViewport: headlineRect ? (headlineRect.left >= 0 && headlineRect.right <= window.innerWidth) : false
        },
        stamp: {
          rect: stampRect,
          distanceToBanner: stampDistanceToBanner,
          overlapsWithBanner: stampOverlap
        },
        banner: {
          rect: bannerRect
        },
        artistCta: {
          watermarkExists: !!watermark,
          cardRect: ctaCardRect,
          titleRect: ctaTitleRect,
          descRect: ctaDescRect,
          btnRect: ctaBtnRect,
          btnBelowDesc,
          btnHref
        }
      };
    });

    report[width] = metrics;

    // Capture screenshots
    if (width === 375) {
      // Mobile Hero
      const heroEl = await page.$('.rh-hero-section');
      if (heroEl) {
        await heroEl.screenshot({
          path: path.join(artifactDir, 'mobile-hero.png')
        });
      }
      // Mobile Artist CTA
      const ctaEl = await page.$('.rh-artist-cta-card');
      if (ctaEl) {
        await ctaEl.screenshot({
          path: path.join(artifactDir, 'mobile-artist-cta.png')
        });
      }
    }

    if (width === 1440) {
      // Desktop Hero
      const heroEl = await page.$('.rh-hero-section');
      if (heroEl) {
        await heroEl.screenshot({
          path: path.join(artifactDir, 'desktop-hero.png')
        });
      }
      // Desktop Artist CTA
      const ctaEl = await page.$('.rh-artist-cta-card');
      if (ctaEl) {
        await ctaEl.screenshot({
          path: path.join(artifactDir, 'desktop-artist-cta.png')
        });
      }
    }

    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(artifactDir, 'visual-corrections-audit.json'), JSON.stringify(report, null, 2));
})();

