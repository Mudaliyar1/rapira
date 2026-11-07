const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  // Option B: Stamp below CTA buttons
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await page.addStyleTag({
    content: `
      @media (max-width: 767.98px) {
        .rapira-homepage .rh-hero-sub-row {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          min-height: auto !important;
          margin-top: 0.4rem !important;
          margin-bottom: 0.85rem !important;
        }
        .rapira-homepage .rh-hero-stamp {
          display: block !important;
          position: static !important;
          order: 3 !important;
          width: 76px !important;
          height: 76px !important;
          margin: 0.85rem auto 0 auto !important;
          top: auto !important;
          left: auto !important;
          transform: none !important;
          pointer-events: none !important;
          z-index: 2 !important;
        }
      }
    `
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'compare-stamp-below-cta.png'),
    clip: { x: 0, y: 0, width: 390, height: 680 }
  });

  await browser.close();
})();

