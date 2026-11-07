const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
  
  const content = await page.content();
  const scriptMatch = content.match(/window\.rapiraHomeReels\s*=\s*([^;]+);/);
  console.log('Script match:', scriptMatch ? scriptMatch[1].substring(0, 200) : 'not found');
  
  await browser.close();
}

test().catch(console.error);

