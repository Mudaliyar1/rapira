const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Test across multiple mobile viewports
  const viewports = [
    { name: '360px', width: 360, height: 740 },
    { name: '375px', width: 375, height: 667 },
    { name: '390px', width: 390, height: 844 },
    { name: '414px', width: 414, height: 896 }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));

    // Try Candidate Style 1: Centered stamp above tagline in sub-row
    await page.addStyleTag({
      content: `
        @media (max-width: 767.98px) {
          .rapira-homepage .rh-hero-sub-row {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            min-height: auto !important;
            margin-top: 0.5rem !important;
            margin-bottom: 1.25rem !important;
          }
          .rapira-homepage .rh-hero-stamp {
            display: block !important;
            position: static !important;
            width: 76px !important;
            height: 76px !important;
            margin: 0 auto 0.65rem auto !important;
            top: auto !important;
            left: auto !important;
            transform: none !important;
            pointer-events: none !important;
            z-index: 2 !important;
          }
          /* Featured Artists spacing */
          .rapira-homepage .rh-artists-section .rh-section-header {
            margin-bottom: 1.25rem !important;
          }
          .rapira-homepage .rh-artists-track-row {
            margin-top: 0 !important;
            padding-top: 0.25rem !important;
          }
        }
      `
    });
    await new Promise(r => setTimeout(r, 500));

    // Screenshot hero
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, `test-candidate1-hero-${vp.name}.png`),
      clip: { x: 0, y: 0, width: vp.width, height: 650 }
    });

    // Screenshot featured artists
    const artistsSec = await page.$('.rh-artists-section');
    if (artistsSec) {
      await artistsSec.screenshot({
        path: path.join(ARTIFACTS_DIR, `test-candidate1-artists-${vp.name}.png`)
      });
    }

    // Check measurements
    const metrics = await page.evaluate(() => {
      const stamp = document.querySelector('.rh-hero-stamp');
      const headline = document.querySelector('.rh-hero-headline');
      const tagline = document.querySelector('.rh-hero-tagline-wrap');
      const cta = document.querySelector('.rh-hero-cta-group');
      const carousel = document.querySelector('.rh-hero-banner-container');
      const header = document.querySelector('.rh-artists-section .rh-section-header');
      const card = document.querySelector('.rh-artist-card');

      const stampRect = stamp ? stamp.getBoundingClientRect() : null;
      const headlineRect = headline ? headline.getBoundingClientRect() : null;
      const taglineRect = tagline ? tagline.getBoundingClientRect() : null;
      const ctaRect = cta ? cta.getBoundingClientRect() : null;
      const carouselRect = carousel ? carousel.getBoundingClientRect() : null;
      const headerRect = header ? header.getBoundingClientRect() : null;
      const cardRect = card ? card.getBoundingClientRect() : null;

      // Check overlaps
      const stampOverlapsHeadline = stampRect && headlineRect && !(stampRect.top >= headlineRect.bottom || stampRect.bottom <= headlineRect.top);
      const stampOverlapsTagline = stampRect && taglineRect && !(stampRect.top >= taglineRect.bottom || stampRect.bottom <= taglineRect.top);
      const stampOverlapsCta = stampRect && ctaRect && !(stampRect.top >= ctaRect.bottom || stampRect.bottom <= ctaRect.top);

      return {
        stampWidth: stampRect ? stampRect.width : 0,
        stampHeight: stampRect ? stampRect.height : 0,
        stampVisible: stampRect ? stampRect.width > 0 && stampRect.height > 0 : false,
        stampOverlapsHeadline,
        stampOverlapsTagline,
        stampOverlapsCta,
        gapHeadlineAndStamp: stampRect && headlineRect ? (stampRect.top - headlineRect.bottom) : null,
        gapStampAndTagline: taglineRect && stampRect ? (taglineRect.top - stampRect.bottom) : null,
        gapArtistsHeaderAndCard: cardRect && headerRect ? (cardRect.top - headerRect.bottom) : null,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
      };
    });

    console.log(`Viewport ${vp.name} metrics:`, JSON.stringify(metrics, null, 2));
  }

  await browser.close();
})();

