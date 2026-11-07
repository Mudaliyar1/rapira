const puppeteer = require('puppeteer');

const TICKET_ID = '6aed6b3721b17fc127765f40';
const SESSION_COOKIE = '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f';

async function inspectTicketPage() {
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

  await page.setViewport({ width: 1440, height: 900 });
  const resp = await page.goto(`http://localhost:3000/tickets/${TICKET_ID}`, {
    waitUntil: 'networkidle2'
  });

  console.log('Status code:', resp.status());
  console.log('Final URL:', page.url());

  const info = await page.evaluate(() => {
    const body = document.body;
    const nav = document.querySelector('nav.navbar');
    const main = document.querySelector('main');
    const stage = document.querySelector('.rapira-ticket-stage');
    const footer = document.querySelector('footer');
    const crowd = document.querySelector('.rapira-ticket-crowd-silhouette');

    return {
      bodyClasses: body.className,
      bodyBg: window.getComputedStyle(body).backgroundColor,
      navClasses: nav ? nav.className : null,
      navBg: nav ? window.getComputedStyle(nav).backgroundColor : null,
      navBorderBottom: nav ? window.getComputedStyle(nav).borderBottom : null,
      mainClasses: main ? main.className : null,
      mainPadding: main ? window.getComputedStyle(main).padding : null,
      stageBg: stage ? window.getComputedStyle(stage).backgroundColor : null,
      stagePadding: stage ? window.getComputedStyle(stage).padding : null,
      footerExists: !!footer,
      footerClasses: footer ? footer.className : null,
      footerBg: footer ? window.getComputedStyle(footer).backgroundColor : null,
      footerDisplay: footer ? window.getComputedStyle(footer).display : null,
      crowdExists: !!crowd
    };
  });

  console.log('Inspection Details:', JSON.stringify(info, null, 2));

  await page.screenshot({ path: 'scratch/current_ticket_desktop.png', fullPage: true });

  await browser.close();
}

inspectTicketPage().catch(console.error);

