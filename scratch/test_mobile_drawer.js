const puppeteer = require('puppeteer');

const CONCERT_ID = '6aec50df716ae22e5aa1797f';
const SESSION_COOKIE = '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f';

async function testDrawer() {
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

  await page.setViewport({ width: 375, height: 812 });
  await page.goto(`http://localhost:3000/concerts/${CONCERT_ID}/book?quantity=2`, {
    waitUntil: 'networkidle2'
  });

  console.log('Clicking hamburger toggler...');
  await page.click('.navbar-toggler');
  // Wait for collapse transition
  await new Promise(r => setTimeout(r, 600));

  const drawerInfo = await page.evaluate(() => {
    const collapse = document.querySelector('.navbar-collapse');
    const links = Array.from(collapse.querySelectorAll('.nav-link')).map(l => l.innerText.trim());
    return {
      collapseClass: collapse.className,
      collapseVisible: window.getComputedStyle(collapse).display !== 'none',
      linksCount: links.length,
      links: links.slice(0, 10),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      overflow: document.documentElement.scrollWidth > window.innerWidth
    };
  });

  console.log('Drawer Info:', JSON.stringify(drawerInfo, null, 2));

  await page.screenshot({ path: 'scratch/mobile_drawer_open_375.png' });

  await browser.close();
}

testDrawer().catch(console.error);

