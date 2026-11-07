const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 950, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  // Scroll section into view first
  await page.evaluate(() => {
    const s = document.querySelector('.rh-how-works-section');
    s.scrollIntoView({ behavior: 'instant', block: 'start' });
    
    // Now scroll track to Card 2
    const track = document.getElementById('howWorksTrack');
    if (track) {
      track.scrollLeft = 287;
      // also update dots
      const dots = document.querySelectorAll('.rh-how-dot');
      if (dots.length > 1) {
        dots[0].classList.remove('active');
        dots[1].classList.add('active');
      }
    }
  });

  await new Promise(r => setTimeout(r, 500));

  const sectionEl = await page.$('.rh-how-works-section');
  if (sectionEl) {
    await sectionEl.screenshot({
      path: path.join('C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d', 'how-rapira-works-mobile-card2.png')
    });
  }

  await browser.close();
  console.log('Mobile Card 2 screenshot generated successfully!');
})();

