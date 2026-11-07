const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER PAGE ERROR:', err.message));

  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
  
  await new Promise(r => setTimeout(r, 2000));

  const check = await page.evaluate(() => {
    return {
      openRapiraReelCard: typeof window.openRapiraReelCard,
      openRapiraReelIndex: typeof window.openRapiraReelIndex,
      openRapiraReel: typeof window.openRapiraReel,
      scripts: Array.from(document.querySelectorAll('script')).map(s => s.src || 'inline').filter(s => s.includes('motion'))
    };
  });

  console.log('Window check:', check);

  await browser.close();
}

test().catch(console.error);

