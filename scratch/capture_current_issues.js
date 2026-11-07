const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Desktop 1440px
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'before-hero-desktop-1440px.png'),
    clip: { x: 0, y: 0, width: 1440, height: 700 }
  });

  // Mobile 390px
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'before-hero-mobile-390px.png'),
    clip: { x: 0, y: 0, width: 390, height: 750 }
  });

  // Featured Artists on mobile 390px
  const artistsSection = await page.$('.rh-artists-section');
  if (artistsSection) {
    await artistsSection.screenshot({
      path: path.join(ARTIFACTS_DIR, 'before-featured-artists-mobile-390px.png')
    });
  }

  // Inspect styles of .rh-artists-section, .rh-section-header, .rh-artists-track-row
  const artistsLayout = await page.evaluate(() => {
    const sec = document.querySelector('.rh-artists-section');
    const header = sec ? sec.querySelector('.rh-section-header') : null;
    const track = sec ? sec.querySelector('.rh-artists-track-row') : null;
    const card = sec ? sec.querySelector('.rh-artist-card') : null;

    const secStyle = sec ? window.getComputedStyle(sec) : null;
    const headerStyle = header ? window.getComputedStyle(header) : null;
    const trackStyle = track ? window.getComputedStyle(track) : null;

    const headerRect = header ? header.getBoundingClientRect() : null;
    const trackRect = track ? track.getBoundingClientRect() : null;
    const cardRect = card ? card.getBoundingClientRect() : null;

    return {
      headerMarginBottom: headerStyle ? headerStyle.marginBottom : null,
      trackMarginTop: trackStyle ? trackStyle.marginTop : null,
      trackPaddingTop: trackStyle ? trackStyle.paddingTop : null,
      gapBetweenHeaderAndCard: (cardRect && headerRect) ? (cardRect.top - headerRect.bottom) : null,
      headerRect,
      trackRect,
      cardRect
    };
  });

  console.log('Mobile 390px Featured Artists Layout:', JSON.stringify(artistsLayout, null, 2));

  await browser.close();
})();

