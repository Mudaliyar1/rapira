const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const CONCERT_URL = 'http://localhost:3000/concerts/6aec50df716ae22e5aa1797f';
const HOMEPAGE_URL = 'http://localhost:3000/';

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // 1. Check Homepage Upcoming Concerts Card
    console.log('Testing Homepage Upcoming Concerts Card...');
    const pageHome = await browser.newPage();
    await pageHome.setViewport({ width: 1440, height: 900 });
    await pageHome.goto(HOMEPAGE_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    const card = await pageHome.$('.rh-concert-card');
    if (card) {
      await card.screenshot({
        path: path.join(ARTIFACTS_DIR, 'upcoming-concerts-card-homepage.png')
      });
      console.log('Saved upcoming-concerts-card-homepage.png');
    } else {
      console.log('rh-concert-card not found on homepage');
    }
    await pageHome.close();

    // 2. Check Concert Detail Page Desktop (1440px)
    console.log('Testing Concert Detail Page Desktop (1440px)...');
    const pageDesktop = await browser.newPage();
    await pageDesktop.setViewport({ width: 1440, height: 1200 });
    await pageDesktop.goto(CONCERT_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Evaluate styles, font family, overflow, iframe presence
    const desktopEval = await pageDesktop.evaluate(() => {
      const heroTitle = document.querySelector('.rh-concert-title');
      const titleFont = heroTitle ? window.getComputedStyle(heroTitle).fontFamily : 'not found';
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const iframes = document.querySelectorAll('iframe').length;
      const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;
      const cards = document.querySelectorAll('.rh-editorial-card').length;
      const heroCard = !!document.querySelector('.rh-concert-hero-card');
      const artistCard = !!document.querySelector('.rh-artist-sidebar-card');
      const venueCard = !!document.querySelector('.rh-venue-map-card');
      const shareButtons = document.querySelectorAll('.rh-share-pill-btn').length;

      return {
        titleFont,
        bodyBg,
        iframes,
        hasOverflow,
        cards,
        heroCard,
        artistCard,
        venueCard,
        shareButtons
      };
    });

    console.log('Desktop page eval:', JSON.stringify(desktopEval, null, 2));

    await pageDesktop.screenshot({
      path: path.join(ARTIFACTS_DIR, 'concert-detail-desktop.png'),
      fullPage: true
    });
    console.log('Saved concert-detail-desktop.png');

    // Section-specific desktop screenshots
    const heroEl = await pageDesktop.$('.rh-concert-hero-card');
    if (heroEl) {
      await heroEl.screenshot({
        path: path.join(ARTIFACTS_DIR, 'concert-detail-hero-section.png')
      });
      console.log('Saved concert-detail-hero-section.png');
    }

    const artistEl = await pageDesktop.$('.rh-artist-sidebar-card');
    if (artistEl) {
      await artistEl.screenshot({
        path: path.join(ARTIFACTS_DIR, 'concert-detail-artist-section.png')
      });
      console.log('Saved concert-detail-artist-section.png');
    }

    const venueEl = await pageDesktop.$('.rh-venue-map-card');
    if (venueEl) {
      await venueEl.screenshot({
        path: path.join(ARTIFACTS_DIR, 'concert-detail-venue-location.png')
      });
      console.log('Saved concert-detail-venue-location.png');
    }

    await pageDesktop.close();

    // 3. Multi-viewport testing (Mobile & Tablet)
    const viewports = [
      { name: 'mobile-360', width: 360, height: 740 },
      { name: 'mobile-375', width: 375, height: 812 },
      { name: 'mobile-390', width: 390, height: 844 },
      { name: 'mobile-414', width: 414, height: 896 },
      { name: 'tablet-768', width: 768, height: 1024 },
      { name: 'laptop-1024', width: 1024, height: 768 }
    ];

    for (const vp of viewports) {
      const pageVp = await browser.newPage();
      await pageVp.setViewport({ width: vp.width, height: vp.height });
      await pageVp.goto(CONCERT_URL, { waitUntil: 'networkidle2', timeout: 30000 });

      const overflow = await pageVp.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        };
      });
      console.log(`Viewport ${vp.name} (${vp.width}px): overflow = ${overflow.hasOverflow} (${overflow.scrollWidth} vs ${overflow.clientWidth})`);

      if (vp.name === 'mobile-390') {
        await pageVp.screenshot({
          path: path.join(ARTIFACTS_DIR, 'concert-detail-mobile.png'),
          fullPage: true
        });
        console.log('Saved concert-detail-mobile.png');
      }

      await pageVp.close();
    }

    console.log('Verification completed successfully!');
  } catch (err) {
    console.error('Puppeteer verification failed:', err);
  } finally {
    await browser.close();
  }
}

run();
