const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setCookie({
    name: 'rapira.sid',
    value: '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f',
    domain: 'localhost',
    path: '/'
  });
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/tickets/6aed6b3721b17fc127765f40', { waitUntil: 'networkidle2' });
  const headerElem = await page.$('.rapira-confirmed-wrap');
  if (headerElem) {
    await headerElem.screenshot({ path: 'scratch/current_header.png' });
  }
  const performerElem = await page.$('.rapira-performer-card');
  if (performerElem) {
    await performerElem.screenshot({ path: 'scratch/current_performer.png' });
  }
  await browser.close();
  console.log('Screenshots saved!');
})();

