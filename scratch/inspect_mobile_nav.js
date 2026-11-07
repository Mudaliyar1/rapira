const puppeteer = require('puppeteer');

async function check() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  // Click the toggler
  await page.click('.navbar-toggler');
  await new Promise(r => setTimeout(r, 600));

  const navHtml = await page.evaluate(() => {
    const nav = document.getElementById('navbarMain');
    return nav ? nav.innerHTML : 'No navbarMain';
  });

  console.log('--- NAVBAR MAIN HTML ---');
  console.log(navHtml);

  // Check if any search element exists
  const searchInfo = await page.evaluate(() => {
    const searchElements = Array.from(document.querySelectorAll('.navbar-collapse *')).filter(el => {
      const cls = el.className || '';
      const text = el.innerText || '';
      const isSearch = (typeof cls === 'string' && cls.includes('search')) || text.includes('Search');
      const href = el.getAttribute ? (el.getAttribute('href') || '') : '';
      return isSearch || href.includes('search') || href === '/content';
    });
    return searchElements.map(el => ({
      tagName: el.tagName,
      className: el.className,
      id: el.id,
      href: el.getAttribute('href'),
      text: el.innerText,
      outerHTML: el.outerHTML
    }));
  });

  console.log('--- SEARCH ELEMENTS FOUND ---');
  console.log(JSON.stringify(searchInfo, null, 2));

  await browser.close();
}

check().catch(console.error);

