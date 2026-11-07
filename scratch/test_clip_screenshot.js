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

  // Disable AOS transitions so opacity is always 1
  await page.addStyleTag({
    content: '[data-aos] { opacity: 1 !important; transform: none !important; transition: none !important; }'
  });

  // Scroll section into view
  await page.evaluate(() => {
    const s = document.querySelector('.rh-artists-section');
    s.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise(r => setTimeout(r, 400));

  // Get exact clip rect of section
  const getClipRect = async () => {
    return await page.evaluate(() => {
      const s = document.querySelector('.rh-artists-section');
      const b = s.getBoundingClientRect();
      return {
        x: 0,
        y: Math.max(0, Math.round(window.scrollY + b.top)),
        width: 375,
        height: Math.round(b.height)
      };
    });
  };

  const clip1 = await getClipRect();

  // 1. Capture Card 1 initial view
  await page.screenshot({
    path: path.join(brainDir, 'featured-artists-mobile-card1.png'),
    clip: clip1
  });
  console.log('Saved featured-artists-mobile-card1.png via clip');

  // 2. Swipe to Card 2:
  // Scroll track so Card 2 is active
  await page.evaluate(async () => {
    const container = document.getElementById('homeArtistsContainer');
    const cards = container.querySelectorAll('.rh-artist-col');
    if (cards[1]) {
      container.scrollLeft = cards[1].offsetLeft;
      container.dispatchEvent(new Event('scroll'));
    }
  });
  await new Promise(r => setTimeout(r, 500));

  const clip2 = await getClipRect();
  await page.screenshot({
    path: path.join(brainDir, 'featured-artists-mobile-card2.png'),
    clip: clip2
  });
  console.log('Saved featured-artists-mobile-card2.png via clip');

  // 3. Swipe back to Card 1:
  await page.evaluate(async () => {
    const container = document.getElementById('homeArtistsContainer');
    const cards = container.querySelectorAll('.rh-artist-col');
    if (cards[0]) {
      container.scrollLeft = 0;
      container.dispatchEvent(new Event('scroll'));
    }
  });
  await new Promise(r => setTimeout(r, 500));

  const clip3 = await getClipRect();
  await page.screenshot({
    path: path.join(brainDir, 'featured-artists-mobile-card1-back.png'),
    clip: clip3
  });
  console.log('Saved featured-artists-mobile-card1-back.png via clip');

  await browser.close();
})();

