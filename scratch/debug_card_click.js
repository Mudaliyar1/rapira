const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => typeof window.openRapiraReelCard === 'function');

  const debug = await page.evaluate(() => {
    const card = document.querySelector('.rh-reel-card');
    console.log('card:', card);
    console.log('card.dataset:', JSON.stringify(card.dataset));
    console.log('getRapiraReels count:', window.getRapiraReels ? window.getRapiraReels().length : 'none');
    
    // Call openRapiraReelCard
    window.openRapiraReelCard(card);

    const modal = document.getElementById('rhReelModal');
    return {
      modalDisplay: modal ? modal.style.display : null,
      bodyHasClass: document.body.classList.contains('rh-modal-open')
    };
  });

  console.log('Debug result:', debug);

  await browser.close();
}

test().catch(console.error);

