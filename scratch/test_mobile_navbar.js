const puppeteer = require('puppeteer');

const CONCERT_ID = '6aec50df716ae22e5aa1797f';
const SESSION_COOKIE = '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f';

async function testNavbar() {
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

  const navDetails = await page.evaluate(() => {
    const nav = document.querySelector('nav.navbar');
    const container = nav ? nav.querySelector('.container, .container-fluid') : null;
    const brand = nav ? nav.querySelector('.navbar-brand') : null;
    const toggler = nav ? nav.querySelector('.navbar-toggler') : null;
    const collapse = nav ? nav.querySelector('.navbar-collapse') : null;

    // Check children of container
    const children = container ? Array.from(container.children).map(c => ({
      tagName: c.tagName,
      className: c.className,
      display: window.getComputedStyle(c).display,
      visibility: window.getComputedStyle(c).visibility,
      box: { width: c.offsetWidth, height: c.offsetHeight }
    })) : [];

    return {
      navWidth: nav ? nav.offsetWidth : 0,
      containerWidth: container ? container.offsetWidth : 0,
      brandBox: brand ? { width: brand.offsetWidth, height: brand.offsetHeight } : null,
      togglerBox: toggler ? { width: toggler.offsetWidth, height: toggler.offsetHeight, display: window.getComputedStyle(toggler).display } : null,
      collapseClasses: collapse ? collapse.className : null,
      collapseDisplay: collapse ? window.getComputedStyle(collapse).display : null,
      children
    };
  });

  console.log('Mobile Navbar Details:', JSON.stringify(navDetails, null, 2));

  await page.screenshot({ path: 'scratch/navbar_mobile_375.png' });

  await browser.close();
}

testNavbar().catch(console.error);

