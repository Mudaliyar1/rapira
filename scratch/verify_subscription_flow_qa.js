const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const SESSION_COOKIE = 'testsessionvenue1234567890abcdef1234567890abcdef1234567890abcdef';
const PURCHASE_URL = 'http://localhost:3000/subscriptions/purchase/6a54d095c9d04cfaf777edc0';
const PLANS_URL = 'http://localhost:3000/subscriptions';
const MY_SUBS_URL = 'http://localhost:3000/subscriptions/my-subscriptions';

async function runQA() {
  console.log('[QA] Starting Comprehensive Subscription Pages QA & Audit...');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_sub_flow_qa_'));

  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tempDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    // ── 1. TEST PURCHASE SUBSCRIPTION PAGE ACROSS VIEWPORTS ──
    const viewports = [
      { name: 'Mobile 360px', width: 360, height: 740 },
      { name: 'Mobile 375px', width: 375, height: 812 },
      { name: 'Mobile 390px', width: 390, height: 844 },
      { name: 'Mobile 414px', width: 414, height: 896 },
      { name: 'Tablet 768px', width: 768, height: 1024 },
      { name: 'Laptop 1024px', width: 1024, height: 768 },
      { name: 'Desktop 1440px', width: 1440, height: 900 }
    ];

    const results = [];

    for (const vp of viewports) {
      console.log(`\n--- Testing Purchase Page on ${vp.name} (${vp.width}x${vp.height}) ---`);
      const page = await browser.newPage();
      await page.setCookie({
        name: 'rapira.sid',
        value: SESSION_COOKIE,
        domain: 'localhost',
        path: '/',
        httpOnly: true
      });

      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
      await page.goto(PURCHASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });

      const audit = await page.evaluate((width) => {
        const docScrollWidth = document.documentElement.scrollWidth;
        const hasHorizontalOverflow = docScrollWidth > width;

        const heading = document.querySelector('.rh-sub-hero-title');
        const headingStyle = heading ? window.getComputedStyle(heading) : null;

        const card = document.querySelector('.rh-sub-purchase-card');
        const cardStyle = card ? window.getComputedStyle(card) : null;

        const infoBox = document.querySelector('.rh-sub-purchase-info-box');
        const infoStyle = infoBox ? window.getComputedStyle(infoBox) : null;

        const payBtn = document.querySelector('#payNowBtn');
        const payBtnStyle = payBtn ? window.getComputedStyle(payBtn) : null;

        const backBtn = document.querySelector('.rh-sub-btn-secondary');
        const backBtnStyle = backBtn ? window.getComputedStyle(backBtn) : null;

        const totalAmount = document.querySelector('.rh-sub-total-amount');

        return {
          width,
          docScrollWidth,
          hasHorizontalOverflow,
          heading: {
            text: heading?.textContent.trim(),
            color: headingStyle?.color,
            fontSize: headingStyle?.fontSize
          },
          card: {
            bg: cardStyle?.backgroundColor,
            borderColor: cardStyle?.borderColor,
            borderRadius: cardStyle?.borderRadius
          },
          infoBox: {
            bg: infoStyle?.backgroundColor,
            borderColor: infoStyle?.borderColor,
            color: infoStyle?.color
          },
          payBtn: {
            text: payBtn?.textContent.trim().replace(/\s+/g, ' '),
            bg: payBtnStyle?.backgroundColor,
            color: payBtnStyle?.color,
            width: payBtn?.offsetWidth
          },
          backBtn: {
            text: backBtn?.textContent.trim().replace(/\s+/g, ' '),
            bg: backBtnStyle?.backgroundColor,
            color: backBtnStyle?.color,
            borderColor: backBtnStyle?.borderColor
          },
          totalAmount: totalAmount?.textContent.trim()
        };
      }, vp.width);

      console.log(`[QA] ${vp.name} audit:`, JSON.stringify(audit, null, 2));
      results.push({ name: vp.name, width: vp.width, ...audit });

      if (vp.width === 375) {
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'purchase-subscription-after-mobile-375px.png'), fullPage: false });
        console.log('[QA] Captured purchase-subscription-after-mobile-375px.png');
      }

      if (vp.width === 1440) {
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'purchase-subscription-after-desktop-1440px.png'), fullPage: false });
        console.log('[QA] Captured purchase-subscription-after-desktop-1440px.png');
      }

      await page.close();
    }

    console.log('\n================ PURCHASE PAGE AUDIT TABLE ================');
    console.table(results.map(r => ({
      Viewport: r.name,
      'No Overflow': !r.hasHorizontalOverflow,
      'Heading Color': r.heading.color,
      'Card BG': r.card.bg,
      'PayBtn BG': r.payBtn.bg,
      'Total Amount': r.totalAmount
    })));

    // ── 2. TEST END-TO-END NAVIGATION FLOW ──
    console.log('\n--- Testing Full Navigation Flow (My Profile -> My Subscriptions -> Browse -> Purchase) ---');
    const flowPage = await browser.newPage();
    await flowPage.setCookie({
      name: 'rapira.sid',
      value: SESSION_COOKIE,
      domain: 'localhost',
      path: '/',
      httpOnly: true
    });
    await flowPage.setViewport({ width: 1440, height: 900 });

    // Step A: My Profile
    console.log('[Flow] 1. Loading My Profile...');
    await flowPage.goto('http://localhost:3000/users/profile', { waitUntil: 'networkidle2' });
    const profileSubCard = await flowPage.$('.rh-profile-card:nth-of-type(2)');
    console.log('[Flow] Profile loaded, sub status section found:', !!profileSubCard);

    // Step B: My Subscriptions
    console.log('[Flow] 2. Loading My Subscriptions...');
    await flowPage.goto(MY_SUBS_URL, { waitUntil: 'networkidle2' });
    const emptyOrActive = await flowPage.evaluate(() => {
      const activeCard = document.querySelector('.my-subscriptions-active-card');
      const expiredCard = document.querySelector('.my-subscriptions-expired-card');
      const emptyCard = document.querySelector('.my-subscriptions-empty-card');
      return {
        hasActive: !!activeCard,
        hasExpired: !!expiredCard,
        hasEmpty: !!emptyCard
      };
    });
    console.log('[Flow] My Subscriptions state:', emptyOrActive);

    // Step C: Browse Plans
    console.log('[Flow] 3. Loading Browse Subscription Plans...');
    await flowPage.goto(PLANS_URL, { waitUntil: 'networkidle2' });
    const planCardCount = await flowPage.evaluate(() => document.querySelectorAll('.rh-sub-card').length);
    console.log(`[Flow] Found ${planCardCount} subscription plan card(s)`);

    // Step D: Click Subscribe Now -> Land on Purchase
    const subscribeLink = await flowPage.$eval('.rh-sub-btn-primary', el => el.href);
    console.log('[Flow] Subscribe link URL:', subscribeLink);
    await flowPage.goto(subscribeLink, { waitUntil: 'networkidle2' });
    console.log('[Flow] Landed on Purchase page:', flowPage.url());

    // Step E: Verify Submit action and attributes
    const formAction = await flowPage.$eval('#purchaseForm', el => el.action);
    console.log('[Flow] Purchase Form action:', formAction);

    await flowPage.close();

    console.log('\n[QA] ALL TESTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('[QA] Fatal Error:', err);
  } finally {
    await browser.close();
  }
}

runQA();

