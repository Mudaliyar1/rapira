const puppeteer = require('puppeteer');

const CONCERT_ID = '6aec50df716ae22e5aa1797f';
const SESSION_COOKIE = '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f';

async function findOverflow() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setCookie({
    name: 'rapira.sid',
    value: SESSION_COOKIE,
    domain: 'localhost',
    path: '/'
  });

  await page.setViewport({ width: 375, height: 812 });
  await page.goto(`http://localhost:3000/concerts/${CONCERT_ID}/select-quantity?step=seats&quantity=2`, {
    waitUntil: 'networkidle2'
  });

  const overflowReport = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    const winWidth = window.innerWidth;
    const bodyWidth = document.body.scrollWidth;

    const overflowing = [];
    const all = document.querySelectorAll('*');
    all.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > winWidth + 1 || rect.right > winWidth + 1 || rect.left < -1) {
        overflowing.push({
          tag: el.tagName,
          id: el.id || '',
          className: el.className || '',
          width: Math.round(rect.width),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth
        });
      }
    });

    return {
      winWidth,
      docWidth,
      bodyWidth,
      overflow: docWidth - winWidth,
      overflowingCount: overflowing.length,
      topOverflowing: overflowing.slice(0, 15)
    };
  });

  console.log('Overflow Report:', JSON.stringify(overflowReport, null, 2));

  await page.screenshot({ path: 'scratch/seat_selection_mobile_current.png', fullPage: true });

  await browser.close();
}

findOverflow().catch(console.error);

