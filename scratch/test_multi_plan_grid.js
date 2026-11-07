const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config();

const SubscriptionPlan = require('../models/SubscriptionPlan');
const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const SESSION_COOKIE = 'testsessionvenue1234567890abcdef1234567890abcdef1234567890abcdef';

async function testMultiPlanGrid() {
  console.log('[QA] Testing dynamic multi-plan grid responsiveness...');
  await mongoose.connect(process.env.MONGODB_URI);

  const testPlan1 = await SubscriptionPlan.create({
    name: 'Fan Club Pro',
    price: 499,
    duration: 30,
    durationUnit: 'days',
    benefits: 'Early ticket presale access\nExclusive member-only livestreams\nHD lossless audio streaming\n10% discount on all concert tickets',
    discountPercentage: 10,
    isActive: true
  });

  const testPlan2 = await SubscriptionPlan.create({
    name: 'All-Access VIP',
    price: 1499,
    duration: 90,
    durationUnit: 'days',
    benefits: 'VIP backstage lounge access\nFree concert guest passes (2 per tour)\nExclusive festival artist meet & greet\nCustom signed merchandise kit\nPriority customer support 24/7\n20% discount on all merchandise',
    discountPercentage: 20,
    isPopular: true,
    isActive: true
  });

  console.log('[QA] Inserted 2 temporary test plans for multi-plan audit.');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_multiplan_'));
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tempDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
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

    // 1. Desktop Test (1440x900)
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.goto('http://localhost:3000/subscriptions', { waitUntil: 'networkidle2' });

    const desktopCards = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.rh-sub-card'));
      const cardTops = cards.map(c => c.offsetTop);
      const cardHeights = cards.map(c => c.offsetHeight);
      const overflow = document.documentElement.scrollWidth > window.innerWidth;
      return {
        count: cards.length,
        cardTops,
        cardHeights,
        sameTopRow: cardTops.every(t => Math.abs(t - cardTops[0]) < 10),
        overflow
      };
    });
    console.log('[QA] Multi-Plan Desktop 1440px audit:', desktopCards);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'subscriptions-index-3plans-desktop.png') });

    // 2. Mobile Test (375x812)
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
    await page.goto('http://localhost:3000/subscriptions', { waitUntil: 'networkidle2' });

    const mobileCards = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.rh-sub-card'));
      const overflow = document.documentElement.scrollWidth > window.innerWidth;
      return {
        count: cards.length,
        overflow
      };
    });
    console.log('[QA] Multi-Plan Mobile 375px audit:', mobileCards);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'subscriptions-index-3plans-mobile.png') });

  } finally {
    await browser.close();

    // Clean up temporary plans
    await SubscriptionPlan.deleteMany({ _id: { $in: [testPlan1._id, testPlan2._id] } });
    console.log('[QA] Cleaned up temporary test plans.');
    await mongoose.disconnect();
  }
}

testMultiPlanGrid().catch(console.error);

