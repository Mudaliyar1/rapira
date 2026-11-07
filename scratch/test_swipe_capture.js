const puppeteer = require('puppeteer');
const path = require('path');

const brainDir = 'C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 950, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  await page.addStyleTag({
    content: '[data-aos] { opacity: 1 !important; transform: none !important; transition: none !important; }'
  });

  const sectionEl = await page.$('.rh-artists-section');

  // 1. Initial State: Card 1 active
  if (sectionEl) {
    await sectionEl.screenshot({
      path: path.join(brainDir, 'featured-artists-mobile-card1.png')
    });
    console.log('Saved card 1');
  }

  // 2. Swiped State: Card 2 active
  await page.evaluate(() => {
    const cards = document.querySelectorAll('.rh-artist-col');
    if (cards.length > 0) {
      cards[0].style.setProperty('margin-left', '-295px', 'important');
    }
    const dots = document.querySelectorAll('#homeArtistsDots .rh-dot');
    if (dots.length > 1) {
      dots[0].classList.remove('active');
      dots[1].classList.add('active');
    }
  });
  await new Promise(r => setTimeout(r, 400));

  if (sectionEl) {
    await sectionEl.screenshot({
      path: path.join(brainDir, 'featured-artists-mobile-card2.png')
    });
    console.log('Saved card 2 (swiped)');
  }

  // 3. Swiped Back: Card 1 active again
  await page.evaluate(() => {
    const cards = document.querySelectorAll('.rh-artist-col');
    if (cards.length > 0) {
      cards[0].style.setProperty('margin-left', '0px', 'important');
    }
    const dots = document.querySelectorAll('#homeArtistsDots .rh-dot');
    if (dots.length > 1) {
      dots[1].classList.remove('active');
      dots[0].classList.add('active');
    }
  });
  await new Promise(r => setTimeout(r, 400));

  if (sectionEl) {
    await sectionEl.screenshot({
      path: path.join(brainDir, 'featured-artists-mobile-card1-back.png')
    });
    console.log('Saved card 1 back');
  }

  await browser.close();
})();
