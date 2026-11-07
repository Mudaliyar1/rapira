const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const fineTunedCss = `
    @media (max-width: 767.98px) {
      .rapira-homepage .rh-card-experience .rh-card-content {
        width: 58% !important;
        max-width: 60% !important;
        padding-right: 0.35rem !important;
      }
      .rapira-homepage .rh-card-experience .rh-card-art {
        flex: 0 0 42% !important;
        width: 42% !important;
        max-width: 44% !important;
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
        max-width: 132px !important;
        height: auto !important;
        max-height: 88% !important;
        object-fit: contain !important;
        object-position: right bottom !important;
        position: static !important;
        transform: none !important;
        filter: drop-shadow(0 6px 14px rgba(159, 25, 14, 0.12)) !important;
      }
    }
    @media (max-width: 375px) {
      .rapira-homepage .rh-card-experience .rh-card-content {
        width: 59% !important;
        max-width: 60% !important;
      }
      .rapira-homepage .rh-card-experience .rh-card-art {
        flex: 0 0 41% !important;
        width: 41% !important;
      }
      .rapira-homepage .rh-card-experience .rh-art-img {
        max-width: 120px !important;
      }
    }
  `;

  const vps = [
    { name: '360px', width: 360, height: 740, isMobile: true },
    { name: '375px', width: 375, height: 667, isMobile: true },
    { name: '390px', width: 390, height: 844, isMobile: true },
    { name: '414px', width: 414, height: 896, isMobile: true }
  ];

  for (const vp of vps) {
    await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    await page.addStyleTag({ content: fineTunedCss });
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
        path: path.join(ARTIFACTS_DIR, `finetuned-card3-${vp.name}.png`)
      });
    }

    const check = await page.evaluate(() => {
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
        titleLineCount: title ? Math.round(titleRect.height / 24) : 0
      };
    });
    console.log(`${vp.name} results:`, check);
  }

  await browser.close();
})();

