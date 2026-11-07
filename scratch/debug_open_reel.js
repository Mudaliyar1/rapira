const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Capture page console logs and errors
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
  
  // Check if homepage-motion.js is loaded
  const status = await page.evaluate(() => {
    return {
      hasOpenIndex: typeof window.openRapiraReelIndex === 'function',
      hasOpenReel: typeof window.openRapiraReel === 'function',
      reelsArrayLength: window.rapiraHomeReels ? window.rapiraHomeReels.length : null,
      cardCount: document.querySelectorAll('.rh-reel-card').length,
      cardOnclick: document.querySelector('.rh-reel-card') ? document.querySelector('.rh-reel-card').getAttribute('onclick') : null
    };
  });
  console.log('Page status:', status);

  // Now try calling window.openRapiraReelIndex(0) directly
  const openResult = await page.evaluate(() => {
    try {
      if (typeof window.openRapiraReelIndex === 'function') {
        window.openRapiraReelIndex(0);
      } else if (typeof window.openRapiraReel === 'function') {
        window.openRapiraReel('mock-0');
      }
      const modal = document.getElementById('rhReelModal');
      return {
        success: true,
        modalDisplay: modal ? modal.style.display : null,
        bodyHasClass: document.body.classList.contains('rh-modal-open')
      };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('Open result:', openResult);

  await browser.close();
}

test().catch(console.error);

