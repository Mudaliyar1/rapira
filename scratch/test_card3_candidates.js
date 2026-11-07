const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Test mobile 390px with different candidate sizes for Card 3
  const candidateSizes = [
    { label: '20percent', maxWidth: '132px', artWidth: '41%' },
    { label: '25percent', maxWidth: '138px', artWidth: '42%' },
    { label: '30percent', maxWidth: '143px', artWidth: '43%' }
  ];

  for (const c of candidateSizes) {
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    await page.addStyleTag({
      content: `
        @media (max-width: 767.98px) {
          .rapira-homepage .rh-card-experience .rh-card-art {
            flex: 0 0 ${c.artWidth} !important;
            width: ${c.artWidth} !important;
            max-width: ${c.artWidth} !important;
          }
          .rapira-homepage .rh-card-experience .rh-art-img {
            max-width: ${c.maxWidth} !important;
          }
        }
      `
    });
    await new Promise(r => setTimeout(r, 400));

    // Scroll to Card 3
    await page.evaluate(() => {
      const track = document.querySelector('.rh-how-cards-track');
      if (track) track.scrollTo({ left: 700, behavior: 'instant' });
    });
    await new Promise(r => setTimeout(r, 300));

    const card3 = await page.$('.rh-card-experience');
    if (card3) {
      await card3.screenshot({
        path: path.join(ARTIFACTS_DIR, `candidate-card3-${c.label}-mobile-390px.png`)
      });
    }

    // Check overlap
    const overlapCheck = await page.evaluate(() => {
      const card = document.querySelector('.rh-card-experience');
      const title = card ? card.querySelector('.rh-card-title') : null;
      const desc = card ? card.querySelector('.rh-card-desc') : null;
      const btn = card ? card.querySelector('.rh-card-cta-btn') : null;
      const img = card ? card.querySelector('.rh-art-img') : null;

      const titleRect = title ? title.getBoundingClientRect() : null;
      const descRect = desc ? desc.getBoundingClientRect() : null;
      const btnRect = btn ? btn.getBoundingClientRect() : null;
      const imgRect = img ? img.getBoundingClientRect() : null;

      function checkOverlap(r1, r2) {
        if (!r1 || !r2) return false;
        return !(r1.right <= r2.left || r1.left >= r2.right || r1.bottom <= r2.top || r1.top >= r2.bottom);
      }

      return {
        imgWidth: imgRect ? imgRect.width : 0,
        imgHeight: imgRect ? imgRect.height : 0,
        overlapsTitle: checkOverlap(titleRect, imgRect),
        overlapsDesc: checkOverlap(descRect, imgRect),
        overlapsBtn: checkOverlap(btnRect, imgRect),
        gapBtnAndImg: (imgRect && btnRect) ? (imgRect.left - btnRect.right) : null,
        gapDescAndImg: (imgRect && descRect) ? (imgRect.left - descRect.right) : null
      };
    });
    console.log(`${c.label} on 390px:`, overlapCheck);
  }

  await browser.close();
})();

