const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const SESSION_COOKIE = 'testsessionvenue1234567890abcdef1234567890abcdef1234567890abcdef';
const MY_SUBS_URL = 'http://localhost:3000/subscriptions/my-subscriptions';

async function checkMySubs() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_mysubs_'));
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tempDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setCookie({
      name: 'rapira.sid',
      value: SESSION_COOKIE,
      domain: 'localhost',
      path: '/',
      httpOnly: true
    });

    // 1. Mobile (375x812)
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
    await page.goto(MY_SUBS_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'my-subscriptions-check-mobile.png'), fullPage: false });
    console.log('Saved my-subscriptions-check-mobile.png');

    // 2. Desktop (1440x900)
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.goto(MY_SUBS_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'my-subscriptions-check-desktop.png'), fullPage: false });
    console.log('Saved my-subscriptions-check-desktop.png');
  } finally {
    await browser.close();
  }
}

checkMySubs();

