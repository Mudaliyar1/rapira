const puppeteer = require('puppeteer');
const os = require('os');
const path = require('path');
const fs = require('fs');

(async () => {
  const tmpDir = path.join(os.tmpdir(), 'pup_rapira_' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tmpDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const viewports = [360, 375, 390, 414, 768, 1440];
  const results = {};

  for (const width of viewports) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

    const data = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const hasHOverflow = doc.scrollWidth > window.innerWidth || body.scrollWidth > window.innerWidth;

      const headline = document.querySelector('.rh-hero-headline');
      const headlineRect = headline ? headline.getBoundingClientRect() : null;
      const headlineScrollWidth = headline ? headline.scrollWidth : 0;
      const headlineClientWidth = headline ? headline.clientWidth : 0;

      const stamp = document.querySelector('.rh-hero-stamp');
      const stampRect = stamp ? stamp.getBoundingClientRect() : null;

      const banner = document.querySelector('.rh-hero-banner-container');
      const bannerRect = banner ? banner.getBoundingClientRect() : null;

      const watermark = document.querySelector('.rh-cta-watermark');
      const artistCta = document.querySelector('.rh-artist-cta-card');
      const artistCtaRect = artistCta ? artistCta.getBoundingClientRect() : null;
      const artistBtn = document.querySelector('.rh-cta-action-btn');
      const artistBtnRect = artistBtn ? artistBtn.getBoundingClientRect() : null;
      const artistDesc = document.querySelector('.rh-artist-cta-desc');
      const artistDescRect = artistDesc ? artistDesc.getBoundingClientRect() : null;

      const stampBannerDistance = (stampRect && bannerRect) ? (bannerRect.top - stampRect.bottom) : null;
      const isOverlapping = (stampRect && bannerRect) ? (stampRect.bottom > bannerRect.top && stampRect.top < bannerRect.bottom) : false;

      return {
        viewportWidth: window.innerWidth,
        hasHOverflow,
        scrollWidth: doc.scrollWidth,
        headline: {
          text: headline ? headline.innerText.trim() : null,
          rect: headlineRect,
          scrollWidth: headlineScrollWidth,
          clientWidth: headlineClientWidth,
          isClipped: headlineScrollWidth > headlineClientWidth
        },
        stamp: {
          rect: stampRect,
          overlapWithBanner: isOverlapping,
          distanceToBanner: stampBannerDistance
        },
        banner: {
          rect: bannerRect
        },
        artistCta: {
          watermarkExists: !!watermark,
          descBottom: artistDescRect ? artistDescRect.bottom : null,
          btnTop: artistBtnRect ? artistBtnRect.top : null,
          btnLeft: artistBtnRect ? artistBtnRect.left : null,
          descLeft: artistDescRect ? artistDescRect.left : null
        }
      };
    });

    results[width] = data;
    await page.close();
  }

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (e) {}
})();
