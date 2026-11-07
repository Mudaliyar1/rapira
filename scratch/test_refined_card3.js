const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const testVps = [
    { name: '360px', width: 360, height: 740, isMobile: true },
    { name: '375px', width: 375, height: 667, isMobile: true },
    { name: '390px', width: 390, height: 844, isMobile: true },
    { name: '414px', width: 414, height: 896, isMobile: true },
    { name: '768px', width: 768, height: 1024, isMobile: false },
    { name: '1440px', width: 1440, height: 900, isMobile: false }
  ];

  const candidateCss = `
    @media (max-width: 767.98px) {
      .rapira-homepage .rh-card-experience .rh-card-content {
        width: 56% !important;
        max-width: 58% !important;
      }
      .rapira-homepage .rh-card-experience .rh-card-art {
        flex: 0 0 44% !important;
        width: 44% !important;
        max-width: 46% !important;
        display: flex !important;
        align-items: flex-end !important;
        justify-content: flex-end !important;
        overflow: hidden !important;
        border-radius: 0 20px 20px 0 !important;
      }
      .rapira-homepage .rh-card-experience .rh-card-art picture {
        width: 100% !important;
        height: 100% !important;
        display: flex !important;
        align-items: flex-end !important;
        justify-content: flex-end !important;
      }
      .rapira-homepage .rh-card-experience .rh-art-img {
        width: auto !important;
        max-width: 135px !important;
        height: auto !important;
        max-height: 90% !important;
        object-fit: contain !important;
        object-position: right bottom !important;
        position: static !important;
        transform: none !important;
        filter: drop-shadow(0 6px 16px rgba(159, 25, 14, 0.12)) !important;
      }
    }
    @media (max-width: 375px) {
      .rapira-homepage .rh-card-experience .rh-art-img {
        max-width: 124px !important;
      }
    }
  `;

  for (const vp of testVps) {
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile
    });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    await page.addStyleTag({ content: candidateCss });
    await new Promise(r => setTimeout(r, 400));

    // Scroll to Card 3 on mobile
    if (vp.isMobile) {
      await page.evaluate(() => {
        const track = document.querySelector('.rh-how-cards-track');
        if (track) track.scrollTo({ left: 700, behavior: 'instant' });
      });
      await new Promise(r => setTimeout(r, 300));
    }

    const card3 = await page.$('.rh-card-experience');
    if (card3) {
      await card3.screenshot({
        path: path.join(ARTIFACTS_DIR, `refined-card3-${vp.name}.png`)
      });
    }

    // Measure bounding boxes
    const metrics = await page.evaluate(() => {
      const card = document.querySelector('.rh-card-experience');
      const title = card ? card.querySelector('.rh-card-title') : null;
      const desc = card ? card.querySelector('.rh-card-desc') : null;
      const btn = card ? card.querySelector('.rh-card-cta-btn') : null;
      const img = card ? card.querySelector('.rh-art-img') : null;
      const art = card ? card.querySelector('.rh-card-art') : null;
      const cardRect = card ? card.getBoundingClientRect() : null;

      const titleRect = title ? title.getBoundingClientRect() : null;
      const descRect = desc ? desc.getBoundingClientRect() : null;
      const btnRect = btn ? btn.getBoundingClientRect() : null;
      const imgRect = img ? img.getBoundingClientRect() : null;
      const artRect = art ? art.getBoundingClientRect() : null;

      function checkOverlap(r1, r2) {
        if (!r1 || !r2) return false;
        return !(r1.right <= r2.left || r1.left >= r2.right || r1.bottom <= r2.top || r1.top >= r2.bottom);
      }

      const imgInsideCard = imgRect && cardRect ? (
        imgRect.left >= cardRect.left - 1 &&
        imgRect.right <= cardRect.right + 1 &&
        imgRect.top >= cardRect.top - 1 &&
        imgRect.bottom <= cardRect.bottom + 1
      ) : false;

      return {
        cardWidth: cardRect ? cardRect.width : 0,
        imgWidth: imgRect ? imgRect.width : 0,
        imgHeight: imgRect ? imgRect.height : 0,
        overlapsTitle: checkOverlap(titleRect, imgRect),
        overlapsDesc: checkOverlap(descRect, imgRect),
        overlapsBtn: checkOverlap(btnRect, imgRect),
        imgInsideCard,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
      };
    });

    console.log(`Metrics for ${vp.name}:`, metrics);
  }

  await browser.close();
})();

