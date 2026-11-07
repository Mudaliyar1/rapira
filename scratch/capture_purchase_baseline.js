const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const SESSION_COOKIE = 'testsessionvenue1234567890abcdef1234567890abcdef1234567890abcdef';
const PURCHASE_URL = 'http://localhost:3000/subscriptions/purchase/6a54d095c9d04cfaf777edc0';

async function captureBaseline() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_purchase_baseline_'));
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
    await page.goto(PURCHASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Mobile URL loaded:', page.url());

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'purchase-subscription-before-mobile.png'), fullPage: false });
    console.log('Saved purchase-subscription-before-mobile.png');

    // 2. Desktop (1440x900)
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.goto(PURCHASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Desktop URL loaded:', page.url());

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'purchase-subscription-before-desktop.png'), fullPage: false });
    console.log('Saved purchase-subscription-before-desktop.png');
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
  }
}

captureBaseline();

