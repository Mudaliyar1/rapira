const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

async function captureDropdowns() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 800 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 800));

  // Open mobile menu
  await page.click('.navbar-toggler');
  await new Promise(r => setTimeout(r, 600));

  // Click Help & Support dropdown
  await page.click('#helpDropdown');
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'current-help-expanded.png')
  });

  // Now click Discover
  await page.click('#discoverDropdown');
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'current-discover-expanded.png')
  });

  await browser.close();
}

captureDropdowns().catch(console.error);

