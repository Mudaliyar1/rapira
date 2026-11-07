const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const TEST_SID = 'testsessionvenue1234567890abcdef1234567890abcdef1234567890abcdef';

async function runBreakpoints() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  await page.setCookie({
    name: 'rapira.sid',
    value: TEST_SID,
    domain: 'localhost',
    path: '/',
    httpOnly: true
  });

  const widths = [360, 375, 390, 414, 768, 1024, 1440];
  const results = [];

  for (const w of widths) {
    await page.setViewport({ width: w, height: 900 });
    await page.goto('http://localhost:3000/users/profile', { waitUntil: 'networkidle2' });

    const scrollCheck = await page.evaluate((width) => {
      const docW = document.documentElement.scrollWidth;
      return {
        viewportWidth: width,
        documentScrollWidth: docW,
        hasOverflow: docW > width + 2
      };
    }, w);

    results.push(scrollCheck);
    console.log(`Breakpoint ${w}px -> scrollWidth: ${scrollCheck.documentScrollWidth}, overflow: ${scrollCheck.hasOverflow}`);
  }

  await browser.close();
  console.log('All breakpoints verified:', results.every(r => !r.hasOverflow));
}

runBreakpoints().catch(console.error);

