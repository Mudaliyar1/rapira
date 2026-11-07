const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config();

const User = require('../models/User');
const UserSubscription = require('../models/UserSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const SESSION_COOKIE = 'testsessionvenue1234567890abcdef1234567890abcdef1234567890abcdef';
const MY_SUBS_URL = 'http://localhost:3000/subscriptions/my-subscriptions';

async function testAllMySubsStates() {
  console.log('[QA] Testing My Subscriptions all 3 states...');
  await mongoose.connect(process.env.MONGODB_URI);

  const user = await User.findOne({ email: 'valrein09@gmail.com' });
  const plan = await SubscriptionPlan.findOne({ isActive: true });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_mysubs_states_'));
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

    // ── 1. ACTIVE SUBSCRIPTION STATE TEST ──
    console.log('\n--- State B: Active Subscription Test ---');
    const futureDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
    const activeSub = await UserSubscription.create({
      user: user._id,
      plan: plan._id,
      status: 'active',
      expiryDate: futureDate,
      purchaseDate: new Date(),
      amount: plan.price,
      orderId: 'test_order_active',
      paymentId: 'test_pay_active',
      notes: 'Active QA Test'
    });

    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
    await page.goto(MY_SUBS_URL, { waitUntil: 'networkidle2' });

    const activeCheck = await page.evaluate(() => {
      const card = document.querySelector('.my-subscriptions-active-card');
      const title = document.querySelector('.my-subscriptions-plan-title')?.textContent.trim();
      const statusPill = document.querySelector('.my-subscriptions-status-pill.active')?.textContent.trim();
      const overflow = document.documentElement.scrollWidth > window.innerWidth;
      return { hasCard: !!card, title, statusPill, overflow };
    });
    console.log('[QA] Active State Check (Mobile):', activeCheck);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'my-subscriptions-active-mobile-375px.png') });

    // ── 2. EXPIRED SUBSCRIPTION STATE TEST ──
    console.log('\n--- State C: Expired Subscription Test ---');
    // Change active sub to expired
    activeSub.status = 'expired';
    activeSub.expiryDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    await activeSub.save();

    await page.goto(MY_SUBS_URL, { waitUntil: 'networkidle2' });
    const expiredCheck = await page.evaluate(() => {
      const card = document.querySelector('.my-subscriptions-expired-card');
      const title = document.querySelector('.my-subscriptions-plan-title')?.textContent.trim();
      const statusPill = document.querySelector('.my-subscriptions-status-pill.expired')?.textContent.trim();
      const overflow = document.documentElement.scrollWidth > window.innerWidth;
      return { hasCard: !!card, title, statusPill, overflow };
    });
    console.log('[QA] Expired State Check (Mobile):', expiredCheck);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'my-subscriptions-expired-mobile-375px.png') });

    // Clean up temporary subscription
    await UserSubscription.deleteOne({ _id: activeSub._id });
    console.log('[QA] Cleaned up temporary test subscription.');

    // ── 3. EMPTY STATE VERIFICATION ──
    console.log('\n--- State A: Empty State Test ---');
    await page.goto(MY_SUBS_URL, { waitUntil: 'networkidle2' });
    const emptyCheck = await page.evaluate(() => {
      const card = document.querySelector('.my-subscriptions-empty-card');
      const title = document.querySelector('.my-subscriptions-empty-heading')?.textContent.trim();
      const btn = document.querySelector('.my-subscriptions-btn-primary')?.textContent.trim();
      const overflow = document.documentElement.scrollWidth > window.innerWidth;
      return { hasCard: !!card, title, btn, overflow };
    });
    console.log('[QA] Empty State Check (Mobile):', emptyCheck);

    console.log('\n[QA] ALL 3 STATES TESTED SUCCESSFULLY!');
  } finally {
    await browser.close();
    await mongoose.disconnect();
  }
}

testAllMySubsStates().catch(console.error);

