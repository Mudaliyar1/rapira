const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 950, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  // Translate the children or track to show Card 2 (swiped)
  await page.evaluate(() => {
    const track = document.getElementById('howWorksTrack');
    if (track) {
      track.style.transform = 'translateX(-288px)';
    }
    const dots = document.querySelectorAll('.rh-how-dot');
    if (dots.length > 1) {
      dots[0].classList.remove('active');
      dots[1].classList.add('active');
    }
  });

  await new Promise(r => setTimeout(r, 300));

  const sectionEl = await page.$('.rh-how-works-section');
  if (sectionEl) {
    await sectionEl.screenshot({
      path: path.join('C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d', 'how-rapira-works-mobile-card2.png')
    });
  }

  await browser.close();
  console.log('Mobile Card 2 swiped screenshot captured successfully via transform simulation!');
})();

