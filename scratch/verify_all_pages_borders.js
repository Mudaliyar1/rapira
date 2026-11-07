const puppeteer = require('puppeteer');

const CONCERT_ID = '6aec50df716ae22e5aa1797f';
const SESSION_COOKIE = '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f';

const PAGES_TO_TEST = [
  { name: 'Home', url: 'http://localhost:3000/' },
  { name: 'About', url: 'http://localhost:3000/about' },
  { name: 'Content Library', url: 'http://localhost:3000/content' },
  { name: 'Vehicle & Seat Selection', url: `http://localhost:3000/concerts/${CONCERT_ID}/book` },
  { name: 'Checkout Page', url: `http://localhost:3000/concerts/${CONCERT_ID}/checkout` },
  { name: 'Ticket Confirmation', url: 'http://localhost:3000/tickets/6aed6b3721b17fc127765f40' }
];

async function verifyAllPages() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setCookie({
    name: 'rapira.sid',
    value: SESSION_COOKIE,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false
  });

  console.log('Testing Global Page Borders & Continuity across key pages:');

  for (const p of PAGES_TO_TEST) {
    await page.setViewport({ width: 1440, height: 900 });
    const resp = await page.goto(p.url, { waitUntil: 'networkidle2' });
    
    const info = await page.evaluate(() => {
      const nav = document.querySelector('nav.navbar');
      const body = document.body;
      const main = document.querySelector('main');
      const footer = document.querySelector('footer');

      const navBorderBottom = nav ? window.getComputedStyle(nav).borderBottom : 'none';
      const bodyBg = window.getComputedStyle(body).backgroundColor;
      const mainPadding = main ? window.getComputedStyle(main).padding : '0px';
      const footerBg = footer ? window.getComputedStyle(footer).backgroundColor : 'none';
      const overflow = document.documentElement.scrollWidth - window.innerWidth;

      return {
        bodyBg,
        navBorderBottom,
        mainPadding,
        footerBg,
        overflow
      };
    });

    console.log(`\nPage: ${p.name} (${p.url}) [HTTP ${resp.status()}]`);
    console.log(`  Body Bg:           ${info.bodyBg}`);
    console.log(`  Nav Border Bottom: ${info.navBorderBottom}`);
    console.log(`  Main Padding:      ${info.mainPadding}`);
    console.log(`  Footer Bg:         ${info.footerBg}`);
    console.log(`  Horizontal Overflow: ${info.overflow}px`);
  }

  await browser.close();
}

verifyAllPages().catch(console.error);

