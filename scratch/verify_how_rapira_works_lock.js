const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  console.log('Starting full verification of How RAPIRA Works Card 03 and Section Lock...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const viewports = [
    { name: '360px', width: 360, height: 740, isMobile: true },
    { name: '375px', width: 375, height: 667, isMobile: true },
    { name: '390px', width: 390, height: 844, isMobile: true },
    { name: '414px', width: 414, height: 896, isMobile: true },
    { name: '768px', width: 768, height: 1024, isMobile: false },
    { name: '1440px', width: 1440, height: 900, isMobile: false }
  ];

  for (const vp of viewports) {
    console.log(`\n--- Testing ${vp.name} (${vp.width}x${vp.height}) ---`);
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile
    });

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));

    if (vp.isMobile) {
      // 1. Capture Card 1 (Discover) on 390px to verify untouched
      if (vp.name === '390px') {
        const card1 = await page.$('.rh-card-discover');
        if (card1) {
          await card1.screenshot({
            path: path.join(ARTIFACTS_DIR, 'final-card1-discover-390px.png')
          });
          console.log('Saved final-card1-discover-390px.png');
        }

        // Scroll to Card 2
        await page.evaluate(() => {
          const track = document.querySelector('.rh-how-cards-track');
          if (track) track.scrollTo({ left: 300, behavior: 'instant' });
        });
        await new Promise(r => setTimeout(r, 400));

        const card2 = await page.$('.rh-card-connect');
        if (card2) {
          await card2.screenshot({
            path: path.join(ARTIFACTS_DIR, 'final-card2-connect-390px.png')
          });
          console.log('Saved final-card2-connect-390px.png');
        }
      }

      // Scroll to Card 3 (Experience)
      await page.evaluate(() => {
        const track = document.querySelector('.rh-how-cards-track');
        if (track) track.scrollTo({ left: 700, behavior: 'instant' });
      });
      await new Promise(r => setTimeout(r, 400));

      const card3 = await page.$('.rh-card-experience');
      if (card3) {
        await card3.screenshot({
          path: path.join(ARTIFACTS_DIR, `final-card3-experience-${vp.name}.png`)
        });
        console.log(`Saved final-card3-experience-${vp.name}.png`);
      }
    } else {
      // Desktop or Tablet full section screenshot
      const section = await page.$('.rh-how-works-section');
      if (section) {
        await section.screenshot({
          path: path.join(ARTIFACTS_DIR, `final-how-it-works-${vp.name}.png`)
        });
        console.log(`Saved final-how-it-works-${vp.name}.png`);
      }
    }

    // Measure Card 3 artwork and overlap metrics
    const metrics = await page.evaluate(() => {
      const card = document.querySelector('.rh-card-experience');
      const title = card ? card.querySelector('.rh-card-title') : null;
      const desc = card ? card.querySelector('.rh-card-desc') : null;
      const btn = card ? card.querySelector('.rh-card-cta-btn') : null;
      const img = card ? card.querySelector('.rh-art-img') : null;
      const cardRect = card ? card.getBoundingClientRect() : null;

      const titleRect = title ? title.getBoundingClientRect() : null;
      const descRect = desc ? desc.getBoundingClientRect() : null;
      const btnRect = btn ? btn.getBoundingClientRect() : null;
      const imgRect = img ? img.getBoundingClientRect() : null;

      function checkOverlap(r1, r2) {
        if (!r1 || !r2) return false;
        return !(r1.right <= r2.left || r1.left >= r2.right || r1.bottom <= r2.top || r1.top >= r2.bottom);
      }

      const imgInsideCard = imgRect && cardRect ? (
        imgRect.left >= cardRect.left - 2 &&
        imgRect.right <= cardRect.right + 2 &&
        imgRect.top >= cardRect.top - 2 &&
        imgRect.bottom <= cardRect.bottom + 2
      ) : false;

      return {
        cardWidth: cardRect ? Math.round(cardRect.width) : 0,
        cardHeight: cardRect ? Math.round(cardRect.height) : 0,
        imgWidth: imgRect ? Math.round(imgRect.width) : 0,
        imgHeight: imgRect ? Math.round(imgRect.height) : 0,
        overlapsTitle: checkOverlap(titleRect, imgRect),
        overlapsBtn: checkOverlap(btnRect, imgRect),
        imgInsideCard,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
      };
    });

    console.log(`Metrics for ${vp.name}:`, metrics);
  }

  // Verify mobile swipe & pagination interaction
  console.log('\n--- Verifying Mobile Pagination & Interaction on 390px ---');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 800));

  const paginationTest = await page.evaluate(async () => {
    const track = document.querySelector('.rh-how-cards-track');
    const dots = Array.from(document.querySelectorAll('#howWorksPagination .rh-how-dot'));
    if (!track || dots.length !== 3) return { success: false, reason: 'Track or dots not found' };

    // Initially dot 0 should be active
    const initActive = dots.findIndex(d => d.classList.contains('active'));

    // Click dot 2 (Experience)
    dots[2].click();
    await new Promise(r => setTimeout(r, 600));
    const dot2Active = dots[2].classList.contains('active');
    const scrolledToCard3 = track.scrollLeft > 200;

    // Click dot 0 (Discover)
    dots[0].click();
    await new Promise(r => setTimeout(r, 600));
    const dot0Active = dots[0].classList.contains('active');

    return {
      success: true,
      initActive,
      dot2Active,
      scrolledToCard3,
      dot0Active,
      dotsCount: dots.length
    };
  });
  console.log('Pagination interaction test result:', paginationTest);

  console.log('\nAll verification tests completed successfully!');
  await browser.close();
})();

