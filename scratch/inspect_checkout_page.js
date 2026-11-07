const puppeteer = require('puppeteer');

const CONCERT_ID = '6aec50df716ae22e5aa1797f';
const SESSION_COOKIE = '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f';

async function inspect() {
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

  console.log('Loading checkout page...');
  await page.setViewport({ width: 1440, height: 900 });
  const resp = await page.goto(`http://localhost:3000/concerts/${CONCERT_ID}/book?quantity=2&seats=A-01,A-02&category=recliner`, {
    waitUntil: 'networkidle2'
  });

  console.log('Final URL:', page.url());
  console.log('Response Status:', resp.status());

  const info = await page.evaluate(() => {
    const nav = document.querySelector('nav.navbar');
    const brand = document.querySelector('.navbar-brand span, .navbar-brand');
    const main = document.querySelector('main');
    const footer = document.querySelector('footer');
    const body = document.body;
    const checkoutPage = document.querySelector('.rapira-checkout-page');

    return {
      bodyBg: window.getComputedStyle(body).backgroundColor,
      navBg: nav ? window.getComputedStyle(nav).backgroundColor : null,
      navClasses: nav ? nav.className : null,
      brandColor: brand ? window.getComputedStyle(brand).color : null,
      mainPadding: main ? window.getComputedStyle(main).padding : null,
      mainBg: main ? window.getComputedStyle(main).backgroundColor : null,
      footerBg: footer ? window.getComputedStyle(footer).backgroundColor : null,
      footerClasses: footer ? footer.className : null,
      footerColor: footer ? window.getComputedStyle(footer).color : null,
      checkoutExists: !!checkoutPage
    };
  });

  console.log('Inspection Result:', JSON.stringify(info, null, 2));

  await page.screenshot({ path: 'scratch/checkout_inspect_desktop.png', fullPage: true });

  // Test mobile 375px
  await page.setViewport({ width: 375, height: 812 });
  const mobileInfo = await page.evaluate(() => {
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      navWidth: document.querySelector('nav.navbar') ? document.querySelector('nav.navbar').offsetWidth : null
    };
  });
  console.log('Mobile 375px Info:', JSON.stringify(mobileInfo, null, 2));

  await page.screenshot({ path: 'scratch/checkout_inspect_mobile.png', fullPage: true });

  await browser.close();
}

inspect().catch(console.error);

