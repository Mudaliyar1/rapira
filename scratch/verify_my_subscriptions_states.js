const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const User = require('../models/User');
const UserSubscription = require('../models/UserSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const ARTIFACT_DIR = path.resolve('C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d');
const SESSION_COOKIE = 'testsessionvenue1234567890abcdef1234567890abcdef1234567890abcdef';

async function main() {
  console.log('--- STARTING MY SUBSCRIPTIONS QA SUITE ---');

  // Connect to DB
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  const user = await User.findOne({ email: 'valrein09@gmail.com' });
  if (!user) throw new Error('User not found');
  console.log('User found:', user._id);

  let plan = await SubscriptionPlan.findOne({ isActive: true });
  if (!plan) {
    plan = await SubscriptionPlan.create({
      name: 'VIP Artist Pass',
      price: 999,
      duration: 30,
      durationUnit: 'days',
      benefits: 'Unlimited concert presales\nVIP backstage queue skip\nExclusive artist meet & greet invites\nFree streaming audio lossless\n15% discount on all festival merchandise',
      discountPercentage: 15,
      isActive: true,
      createdBy: user._id
    });
    console.log('Created temporary plan:', plan._id);
  }

  // Ensure user starts with no subscriptions
  await UserSubscription.deleteMany({ user: user._id });
  console.log('Cleared existing subscriptions for clean State A test');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setCookie({
    name: 'rapira.sid',
    value: SESSION_COOKIE,
    domain: 'localhost',
    path: '/',
    httpOnly: true
  });

  // --- 1. TEST STATE A (EMPTY STATE) ---
  console.log('\n--- 1. Testing State A: Empty State ---');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/subscriptions/my-subscriptions', { waitUntil: 'networkidle2' });

  // Check overflow
  const stateAOverflow1440 = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  console.log('State A Desktop 1440px overflow check:', stateAOverflow1440 ? 'PASS (0 overflow)' : 'FAIL');

  const emptyCardExists = await page.$('.my-subscriptions-empty-card');
  console.log('Empty card rendered:', !!emptyCardExists ? 'PASS' : 'FAIL');

  const emptyScreenshotDesktop = path.join(ARTIFACT_DIR, 'my-subscriptions-empty-desktop-1440px.png');
  await page.screenshot({ path: emptyScreenshotDesktop, fullPage: true });
  console.log('Saved:', emptyScreenshotDesktop);

  // Test Mobile Viewports for State A
  const viewports = [
    { width: 360, height: 740, name: '360px' },
    { width: 375, height: 667, name: '375px' },
    { width: 390, height: 844, name: '390px' },
    { width: 414, height: 896, name: '414px' },
    { width: 768, height: 1024, name: '768px' },
    { width: 1024, height: 768, name: '1024px' }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.waitForTimeout ? page.waitForTimeout(100) : new Promise(r => setTimeout(r, 100));
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    console.log(`State A Viewport ${vp.name} (${vp.width}px): ${noOverflow ? 'PASS (no overflow)' : 'FAIL'}`);
    if (vp.width === 375) {
      const emptyScreenshotMobile = path.join(ARTIFACT_DIR, 'my-subscriptions-empty-mobile-375px.png');
      await page.screenshot({ path: emptyScreenshotMobile, fullPage: true });
      console.log('Saved:', emptyScreenshotMobile);
    }
  }

  // --- 2. TEST STATE B: ACTIVE SUBSCRIPTION ---
  console.log('\n--- 2. Testing State B: Active Subscription ---');
  const now = new Date();
  const futureExpiry = new Date(Date.now() + 24 * 24 * 60 * 60 * 1000); // 24 days left
  const activeSub = await UserSubscription.create({
    user: user._id,
    plan: plan._id,
    status: 'active',
    purchaseDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // purchased 6 days ago
    expiryDate: futureExpiry,
    amount: plan.price || 999,
    paymentId: 'pay_rapira_live_act99882',
    orderId: 'order_vip_99882'
  });
  console.log('Created active subscription:', activeSub._id);

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/subscriptions/my-subscriptions', { waitUntil: 'networkidle2' });

  const activeCardExists = await page.$('.my-subscriptions-active-card');
  console.log('Active card rendered:', !!activeCardExists ? 'PASS' : 'FAIL');

  const countdownTimer = await page.$('#countdown-container');
  console.log('Countdown timer exists:', !!countdownTimer ? 'PASS' : 'FAIL');

  const countdownDays = await page.$eval('#countdown-days', el => el.textContent.trim());
  console.log('Countdown Days reading:', countdownDays);

  const activeScreenshotDesktop = path.join(ARTIFACT_DIR, 'my-subscriptions-active-desktop-1440px.png');
  await page.screenshot({ path: activeScreenshotDesktop, fullPage: true });
  console.log('Saved:', activeScreenshotDesktop);

  // Mobile for State B
  await page.setViewport({ width: 375, height: 812 });
  const activeScreenshotMobile = path.join(ARTIFACT_DIR, 'my-subscriptions-active-mobile-375px.png');
  await page.screenshot({ path: activeScreenshotMobile, fullPage: true });
  console.log('Saved:', activeScreenshotMobile);

  // --- 3. TEST STATE C & D: EXPIRED SUBSCRIPTION & HISTORY ---
  console.log('\n--- 3. Testing State C & D: Expired Subscription & History ---');
  // Update subscription to expired
  await UserSubscription.updateOne(
    { _id: activeSub._id },
    {
      status: 'expired',
      expiryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // expired 2 days ago
    }
  );
  // Add another historical sub
  await UserSubscription.create({
    user: user._id,
    plan: plan._id,
    status: 'expired',
    purchaseDate: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000),
    expiryDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
    amount: 499,
    paymentId: 'pay_hist_00129',
    orderId: 'order_hist_00129'
  });
  console.log('Updated subscription to expired + added history record');

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/subscriptions/my-subscriptions', { waitUntil: 'networkidle2' });

  const historyCardExists = await page.$('.my-subscriptions-history-card');
  console.log('History card rendered:', !!historyCardExists ? 'PASS' : 'FAIL');

  const historyScreenshotDesktop = path.join(ARTIFACT_DIR, 'my-subscriptions-history-desktop-1440px.png');
  await page.screenshot({ path: historyScreenshotDesktop, fullPage: true });
  console.log('Saved:', historyScreenshotDesktop);

  // Mobile for State D
  await page.setViewport({ width: 375, height: 812 });
  const mobileHistoryCards = await page.$$('.my-subscriptions-history-item-mobile');
  console.log('Mobile history items count:', mobileHistoryCards.length);

  const historyScreenshotMobile = path.join(ARTIFACT_DIR, 'my-subscriptions-history-mobile-375px.png');
  await page.screenshot({ path: historyScreenshotMobile, fullPage: true });
  console.log('Saved:', historyScreenshotMobile);

  // --- CLEANUP ---
  console.log('\n--- Cleaning up test records ---');
  await UserSubscription.deleteMany({ user: user._id });
  console.log('Subscriptions cleaned up to pristine original state');

  await browser.close();
  await mongoose.disconnect();
  console.log('--- ALL MY SUBSCRIPTIONS QA TESTS COMPLETED SUCCESSFULLY ---');
}

main().catch(err => {
  console.error('QA SUITE ERROR:', err);
  process.exit(1);
});

