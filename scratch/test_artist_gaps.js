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

  const gaps = [
    { name: 'gap-20px', mb: '1.25rem', mt: '0', pt: '0' },
    { name: 'gap-24px', mb: '1.25rem', mt: '0', pt: '0.25rem' },
    { name: 'gap-28px', mb: '1.5rem', mt: '0', pt: '0.25rem' },
    { name: 'gap-32px', mb: '1.5rem', mt: '0', pt: '0.5rem' }
  ];

  for (const g of gaps) {
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    await page.addStyleTag({
      content: `
        @media (max-width: 767.98px) {
          .rapira-homepage .rh-artists-section .rh-section-header {
            margin-bottom: ${g.mb} !important;
          }
          .rapira-homepage .rh-artists-track-row {
            margin-top: ${g.mt} !important;
            padding-top: ${g.pt} !important;
          }
        }
      `
    });
    await new Promise(r => setTimeout(r, 400));

    const artistsSec = await page.$('.rh-artists-section');
    if (artistsSec) {
      await artistsSec.screenshot({
        path: path.join(ARTIFACTS_DIR, `artists-${g.name}.png`)
      });
    }

    const measuredGap = await page.evaluate(() => {
      const header = document.querySelector('.rh-artists-section .rh-section-header');
      const card = document.querySelector('.rh-artist-card');
      return (card && header) ? (card.getBoundingClientRect().top - header.getBoundingClientRect().bottom) : null;
    });
    console.log(`${g.name} -> measured: ${measuredGap}px`);
  }

  await browser.close();
})();

