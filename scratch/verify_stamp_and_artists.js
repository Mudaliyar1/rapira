const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  console.log('Starting verification of Hero Culture Stamp and Featured Artists Spacing across viewports...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const testViewports = [
    { name: '360px', width: 360, height: 740, isMobile: true },
    { name: '375px', width: 375, height: 667, isMobile: true },
    { name: '390px', width: 390, height: 844, isMobile: true },
    { name: '414px', width: 414, height: 896, isMobile: true },
    { name: '768px', width: 768, height: 1024, isMobile: false },
    { name: '1440px', width: 1440, height: 900, isMobile: false }
  ];

  for (const vp of testViewports) {
    console.log(`\nTesting viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile
    });

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));

    // Capture Hero screenshot
    const heroEl = await page.$('.rh-hero-section');
    if (heroEl) {
      await heroEl.screenshot({
        path: path.join(ARTIFACTS_DIR, `after-hero-${vp.name}.png`)
      });
      console.log(`Saved after-hero-${vp.name}.png`);
    }

    // Capture Featured Artists screenshot
    const artistsSec = await page.$('.rh-artists-section');
    if (artistsSec) {
      await artistsSec.screenshot({
        path: path.join(ARTIFACTS_DIR, `after-featured-artists-${vp.name}.png`)
      });
      console.log(`Saved after-featured-artists-${vp.name}.png`);
    }

    // Detailed metrics evaluation
    const metrics = await page.evaluate(() => {
      const stamp = document.querySelector('.rh-hero-stamp');
      const stampSvg = document.querySelector('.rh-stamp-svg');
      const headline = document.querySelector('.rh-hero-headline');
      const tagline = document.querySelector('.rh-hero-tagline-wrap');
      const cta = document.querySelector('.rh-hero-cta-group');
      const carousel = document.querySelector('.rh-hero-banner-container');
      const artistsSec = document.querySelector('.rh-artists-section');
      const artistsHeader = artistsSec ? artistsSec.querySelector('.rh-section-header') : null;
      const artistsTrack = artistsSec ? artistsSec.querySelector('.rh-artists-track-row') : null;
      const firstCard = artistsSec ? artistsSec.querySelector('.rh-artist-card') : null;
      const swipeLabel = artistsSec ? artistsSec.querySelector('.rh-artists-swipe-label') : null;
      const dotsContainer = artistsSec ? artistsSec.querySelector('.rh-artists-dots') : null;

      const stampRect = stamp ? stamp.getBoundingClientRect() : null;
      const headlineRect = headline ? headline.getBoundingClientRect() : null;
      const taglineRect = tagline ? tagline.getBoundingClientRect() : null;
      const ctaRect = cta ? cta.getBoundingClientRect() : null;
      const carouselRect = carousel ? carousel.getBoundingClientRect() : null;
      const artistsHeaderRect = artistsHeader ? artistsHeader.getBoundingClientRect() : null;
      const firstCardRect = firstCard ? firstCard.getBoundingClientRect() : null;
      const swipeLabelRect = swipeLabel ? swipeLabel.getBoundingClientRect() : null;
      const dotsRect = dotsContainer ? dotsContainer.getBoundingClientRect() : null;

      // Stamp visibility & animation
      const stampComputed = stamp ? window.getComputedStyle(stamp) : null;
      const stampSvgComputed = stampSvg ? window.getComputedStyle(stampSvg) : null;

      // Overlap checks
      const stampOverlapsHeadline = stampRect && headlineRect && !(stampRect.top >= headlineRect.bottom || stampRect.bottom <= headlineRect.top);
      const stampOverlapsTagline = stampRect && taglineRect && !(stampRect.top >= taglineRect.bottom || stampRect.bottom <= taglineRect.top);
      const stampOverlapsCta = stampRect && ctaRect && !(stampRect.top >= ctaRect.bottom || stampRect.bottom <= ctaRect.top);
      const stampOverlapsCarousel = stampRect && carouselRect && !(stampRect.top >= carouselRect.bottom || stampRect.bottom <= carouselRect.top);

      // Featured Artists gap
      const gapArtistsHeaderAndCard = (firstCardRect && artistsHeaderRect) ? (firstCardRect.top - artistsHeaderRect.bottom) : null;

      // Horizontal overflow
      const docWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      const hasHorizontalOverflow = docWidth > winWidth;

      return {
        stamp: {
          display: stampComputed ? stampComputed.display : 'none',
          visibility: stampComputed ? stampComputed.visibility : 'hidden',
          width: stampRect ? stampRect.width : 0,
          height: stampRect ? stampRect.height : 0,
          animation: stampSvgComputed ? stampSvgComputed.animationName : null,
          overlapsHeadline: stampOverlapsHeadline,
          overlapsTagline: stampOverlapsTagline,
          overlapsCta: stampOverlapsCta,
          overlapsCarousel: stampOverlapsCarousel
        },
        featuredArtists: {
          gapBetweenHeaderAndCard: gapArtistsHeaderAndCard,
          swipeLabelVisible: swipeLabelRect ? swipeLabelRect.width > 0 : false,
          dotsVisible: dotsRect ? dotsRect.width > 0 : false
        },
        hasHorizontalOverflow,
        docWidth,
        winWidth
      };
    });

    console.log(`Results for ${vp.name}:`, JSON.stringify(metrics, null, 2));
  }

  // Also test swiping/scrolling on mobile (390px)
  console.log('\nTesting carousel scroll interaction on 390px...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  const scrollResult = await page.evaluate(async () => {
    const track = document.querySelector('.rh-artists-track-row');
    if (!track) return { found: false };
    const initialScroll = track.scrollLeft;
    track.scrollBy({ left: 150, behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 500));
    const afterScroll = track.scrollLeft;
    return {
      found: true,
      initialScroll,
      afterScroll,
      scrolledSuccessfully: afterScroll > initialScroll
    };
  });
  console.log('Featured Artists scroll interaction test:', scrollResult);

  console.log('\nAll verification tests completed successfully!');
  await browser.close();
})();

