const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

async function runQA() {
  console.log('=== STARTING SUBSCRIPTION PLANS QA SUITE ===');

  const auditReport = {
    timestamp: new Date().toISOString(),
    tests: [],
    viewports: [],
    dynamicScenarios: [],
    screenshots: []
  };

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Part 1: Live Server Verification (1 Plan layout on port 3000)
  console.log('[Live Test 1] Testing Live Page at 1440px Desktop...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/subscriptions', { waitUntil: 'networkidle2' });

  const liveAudit = await page.evaluate(() => {
    const pageWrapper = document.querySelector('.rapira-subscriptions-page');
    const heroTitle = document.querySelector('.rh-sub-hero-title');
    const crownIcon = document.querySelector('.rh-sub-crown-icon');
    const card = document.querySelector('.rh-sub-card');
    const infoCard = document.querySelector('.rh-sub-info-card');
    const planName = card?.querySelector('.rh-sub-plan-name')?.innerText.trim();
    const priceText = card?.querySelector('.rh-sub-price-row')?.innerText.trim();
    const benefits = Array.from(card?.querySelectorAll('.rh-sub-benefit-text') || []).map(b => b.innerText.trim());
    const subscribeBtn = card?.querySelector('.rh-sub-btn-primary');

    return {
      hasWrapper: Boolean(pageWrapper),
      wrapperBg: pageWrapper ? window.getComputedStyle(pageWrapper).backgroundColor : null,
      titleText: heroTitle?.innerText.trim(),
      titleFont: heroTitle ? window.getComputedStyle(heroTitle).fontFamily : null,
      titleColor: heroTitle ? window.getComputedStyle(heroTitle).color : null,
      hasCrown: Boolean(crownIcon),
      hasPlanCard: Boolean(card),
      hasInfoCard: Boolean(infoCard),
      planName,
      priceText,
      benefits,
      subscribeBtnText: subscribeBtn?.innerText.trim(),
      subscribeBtnHref: subscribeBtn?.getAttribute('href'),
      infoSections: Array.from(infoCard?.querySelectorAll('.rh-sub-info-block-title') || []).map(t => t.innerText.trim())
    };
  });

  console.log('Live Audit Result:', JSON.stringify(liveAudit, null, 2));

  auditReport.tests.push({
    name: 'Live 1-Plan Layout & Data Integrity',
    passed: liveAudit.hasWrapper &&
            liveAudit.titleColor === 'rgb(159, 25, 14)' &&
            liveAudit.hasCrown &&
            liveAudit.planName === 'Testing' &&
            liveAudit.hasInfoCard &&
            liveAudit.infoSections.includes('How Subscriptions Work') &&
            liveAudit.infoSections.includes('Renewal Policy') &&
            liveAudit.infoSections.includes('Need Help?'),
    actual: liveAudit
  });

  const desktopLiveScreenshot = 'subscriptions-desktop-1440px.png';
  await page.screenshot({ path: path.join(ARTIFACT_DIR, desktopLiveScreenshot), fullPage: true });
  auditReport.screenshots.push(desktopLiveScreenshot);

  // Part 2: Mandatory 8 Viewport Responsive Testing (Live Page)
  console.log('[Live Test 2] Testing 8 Mandatory Viewports for Horizontal Overflow...');
  const targetViewports = [
    { width: 360, height: 740, label: '360px' },
    { width: 375, height: 812, label: '375px' },
    { width: 390, height: 844, label: '390px' },
    { width: 414, height: 896, label: '414px' },
    { width: 768, height: 1024, label: '768px' },
    { width: 1024, height: 768, label: '1024px' },
    { width: 1280, height: 800, label: '1280px' },
    { width: 1440, height: 900, label: '1440px' }
  ];

  for (const vp of targetViewports) {
    await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 768 });
    await page.goto('http://localhost:3000/subscriptions', { waitUntil: 'networkidle2' });

    const overflowCheck = await page.evaluate((w) => {
      const scrollW = document.documentElement.scrollWidth;
      const innerW = window.innerWidth;
      return {
        viewportWidth: w,
        scrollWidth: scrollW,
        innerWidth: innerW,
        hasOverflow: scrollW > innerW + 1
      };
    }, vp.width);

    const vpScreenshot = `subscriptions-${vp.width}px.png`;
    await page.screenshot({ path: path.join(ARTIFACT_DIR, vpScreenshot), fullPage: false });

    console.log(`  - ${vp.label}: Overflow = ${overflowCheck.hasOverflow} (scroll: ${overflowCheck.scrollWidth}px, inner: ${overflowCheck.innerWidth}px)`);

    auditReport.viewports.push({
      width: vp.width,
      height: vp.height,
      hasHorizontalOverflow: overflowCheck.hasOverflow,
      passed: !overflowCheck.hasOverflow,
      screenshot: vpScreenshot
    });
    auditReport.screenshots.push(vpScreenshot);
  }

  // Part 3: Dynamic Multi-Plan Scenarios Testing
  console.log('[Part 3] Testing Dynamic Plan Scenarios with Mock Data Harness...');
  const app = express();
  app.use(expressLayouts);
  app.set('layout', 'layouts/main');
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));
  app.use(express.static(path.join(__dirname, '../public')));

  app.locals.menuSettings = {
    discoverMenu: { items: { home: true, concerts: true } },
    servicesMenu: { items: { artistDemo: true } },
    shopMenu: { items: { exploreShop: true } },
    helpMenu: { items: { helpCenter: true } }
  };
  app.locals.themeSettings = null;
  app.locals.siteSettings = {};
  app.locals.currentUser = null;
  app.locals.path = '/subscriptions';

  let scenarioPlans = [];
  let scenarioUser = { _id: 'test_user_id', name: 'Test Fan', role: 'fan' };

  app.get('/test-subscriptions', (req, res) => {
    res.render('subscriptions/index', {
      title: 'Subscription Plans',
      path: '/subscriptions',
      plans: scenarioPlans,
      currentUser: scenarioUser
    });
  });

  const server = app.listen(3333);
  console.log('Dynamic Test Harness running on port 3333');

  // Scenario A: 2 Plans (Side-by-side equal cards)
  console.log('  Testing Scenario: 2 Plans...');
  scenarioPlans = [
    {
      _id: 'plan_1',
      name: 'Fan Pass',
      price: 99,
      duration: 30,
      durationUnit: 'days',
      benefits: 'Ad-free listening, Early access to concert drops',
      discountPercentage: 5,
      isActive: true
    },
    {
      _id: 'plan_2',
      name: 'VIP All-Access',
      price: 299,
      duration: 90,
      durationUnit: 'days',
      benefits: 'VIP backstage access, Free merch bundle, Priority ticket booking',
      discountPercentage: 15,
      isActive: true,
      isPopular: true
    }
  ];

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3333/test-subscriptions', { waitUntil: 'networkidle2' });
  const scenario2Audit = await page.evaluate(() => {
    const cards = document.querySelectorAll('.rh-sub-card');
    const infoCard = document.querySelector('.rh-sub-info-card');
    const popularBadge = document.querySelector('.rh-sub-popular-badge');
    return {
      cardsRendered: cards.length,
      hasInfoCardBelow: Boolean(infoCard),
      hasPopularBadge: Boolean(popularBadge),
      popularBadgeText: popularBadge?.innerText.trim()
    };
  });
  console.log('  Scenario 2 (2 Plans) Result:', scenario2Audit);
  const screenshot2Plans = 'subscriptions-scenario-2plans.png';
  await page.screenshot({ path: path.join(ARTIFACT_DIR, screenshot2Plans), fullPage: true });
  auditReport.dynamicScenarios.push({
    name: '2 Plans Adaptive Side-by-Side Grid',
    passed: scenario2Audit.cardsRendered === 2 && scenario2Audit.hasInfoCardBelow && scenario2Audit.hasPopularBadge,
    actual: scenario2Audit,
    screenshot: screenshot2Plans
  });
  auditReport.screenshots.push(screenshot2Plans);

  // Scenario B: 3 Plans (3-column grid)
  console.log('  Testing Scenario: 3 Plans...');
  scenarioPlans = [
    {
      _id: 'plan_starter',
      name: 'Starter Fan',
      price: 49,
      duration: 30,
      durationUnit: 'days',
      benefits: 'Ad-free streaming, Standard badge',
      discountPercentage: 0,
      isActive: true
    },
    {
      _id: 'plan_pro',
      name: 'Pro Listener',
      price: 149,
      duration: 90,
      durationUnit: 'days',
      benefits: 'HQ Audio, 10% concert discounts, Exclusive drops',
      discountPercentage: 10,
      isActive: true,
      popular: true
    },
    {
      _id: 'plan_ultimate',
      name: 'Rapira Legend',
      price: 499,
      duration: 365,
      durationUnit: 'days',
      benefits: 'Backstage invites, Unlimited HD downloads, Direct artist DMs, Signed poster',
      discountPercentage: 25,
      isActive: true
    }
  ];

  await page.goto('http://localhost:3333/test-subscriptions', { waitUntil: 'networkidle2' });
  const scenario3Audit = await page.evaluate(() => {
    const cards = document.querySelectorAll('.rh-sub-card');
    const gridCols = document.querySelector('.row-cols-lg-3');
    return {
      cardsRendered: cards.length,
      has3ColGrid: Boolean(gridCols)
    };
  });
  console.log('  Scenario 3 (3 Plans) Result:', scenario3Audit);
  const screenshot3Plans = 'subscriptions-scenario-3plans.png';
  await page.screenshot({ path: path.join(ARTIFACT_DIR, screenshot3Plans), fullPage: true });
  auditReport.dynamicScenarios.push({
    name: '3 Plans Adaptive 3-Column Grid',
    passed: scenario3Audit.cardsRendered === 3 && scenario3Audit.has3ColGrid,
    actual: scenario3Audit,
    screenshot: screenshot3Plans
  });
  auditReport.screenshots.push(screenshot3Plans);

  // Scenario C: 6 Plans (Multiple wrapping rows)
  console.log('  Testing Scenario: 6 Plans (Wrapping Rows)...');
  scenarioPlans = [
    { _id: 'p1', name: 'Bronze', price: 29, duration: 30, durationUnit: 'days', benefits: 'Basic Access', isActive: true },
    { _id: 'p2', name: 'Silver', price: 79, duration: 60, durationUnit: 'days', benefits: 'Silver Perks', isActive: true },
    { _id: 'p3', name: 'Gold', price: 149, duration: 90, durationUnit: 'days', benefits: 'Gold Perks', isActive: true, isPopular: true },
    { _id: 'p4', name: 'Platinum', price: 299, duration: 180, durationUnit: 'days', benefits: 'Platinum Perks', isActive: true },
    { _id: 'p5', name: 'Diamond', price: 599, duration: 365, durationUnit: 'days', benefits: 'Diamond Perks', isActive: true },
    { _id: 'p6', name: 'Founder Pass', price: 999, duration: 730, durationUnit: 'days', benefits: 'Lifetime Perks', isActive: true }
  ];

  await page.goto('http://localhost:3333/test-subscriptions', { waitUntil: 'networkidle2' });
  const scenario6Audit = await page.evaluate(() => {
    const cards = document.querySelectorAll('.rh-sub-card');
    return {
      cardsRendered: cards.length
    };
  });
  console.log('  Scenario 6 (6 Plans) Result:', scenario6Audit);
  const screenshot6Plans = 'subscriptions-scenario-6plans.png';
  await page.screenshot({ path: path.join(ARTIFACT_DIR, screenshot6Plans), fullPage: true });
  auditReport.dynamicScenarios.push({
    name: '6 Plans Multi-Row Grid',
    passed: scenario6Audit.cardsRendered === 6,
    actual: scenario6Audit,
    screenshot: screenshot6Plans
  });
  auditReport.screenshots.push(screenshot6Plans);

  // Scenario D: Edge Cases (Many benefits, no benefits, long name)
  console.log('  Testing Scenario: Edge Cases (Heavy benefits vs No benefits vs Long name)...');
  scenarioPlans = [
    {
      _id: 'p_heavy',
      name: 'Ultra Max Super Producer & VIP Pass',
      price: 1999,
      duration: 365,
      durationUnit: 'days',
      description: 'Comprehensive annual subscription for passionate rap fans and independent creators desiring the complete studio experience.',
      benefits: `Lossless master audio streaming
Unlimited track downloads
Priority customer assistance
Custom verified profile badge
Exclusive merch bundle shipped free
Quarterly concert guestlist spot
Access to private Discord and Telegram communities
Early drop notification 48 hours prior
Free beats monthly pack
Royalty discount on marketplace licenses`,
      discountPercentage: 20,
      isActive: true
    },
    {
      _id: 'p_nobenefits',
      name: 'Basic Access',
      price: 10,
      duration: 7,
      durationUnit: 'days',
      benefits: '',
      discountPercentage: 0,
      isActive: true
    }
  ];

  await page.goto('http://localhost:3333/test-subscriptions', { waitUntil: 'networkidle2' });
  const edgeCaseAudit = await page.evaluate(() => {
    const heavyCard = document.querySelectorAll('.rh-sub-card')[0];
    const noBenefitCard = document.querySelectorAll('.rh-sub-card')[1];
    const heavyBenefitsCount = heavyCard?.querySelectorAll('.rh-sub-benefit-item').length;
    const noBenefitsFallback = Boolean(noBenefitCard?.querySelector('.rh-sub-no-benefits'));
    const btnHeavy = heavyCard?.querySelector('.rh-sub-btn-primary');
    const btnNoBenefit = noBenefitCard?.querySelector('.rh-sub-btn-primary');

    return {
      heavyBenefitsCount,
      noBenefitsFallback,
      heavyButtonVisible: Boolean(btnHeavy),
      noBenefitButtonVisible: Boolean(btnNoBenefit)
    };
  });
  console.log('  Edge Case Audit Result:', edgeCaseAudit);
  const screenshotEdgeCase = 'subscriptions-scenario-edgecases.png';
  await page.screenshot({ path: path.join(ARTIFACT_DIR, screenshotEdgeCase), fullPage: true });
  auditReport.dynamicScenarios.push({
    name: 'Edge Cases (Many Benefits Natural Expansion & No Benefits Clean Fallback)',
    passed: edgeCaseAudit.heavyBenefitsCount >= 10 && edgeCaseAudit.noBenefitsFallback && edgeCaseAudit.heavyButtonVisible && edgeCaseAudit.noBenefitButtonVisible,
    actual: edgeCaseAudit,
    screenshot: screenshotEdgeCase
  });
  auditReport.screenshots.push(screenshotEdgeCase);

  server.close();
  await browser.close();

  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'subscriptions-qa-audit.json'),
    JSON.stringify(auditReport, null, 2)
  );

  console.log('=== SUBSCRIPTIONS QA COMPLETED SUCCESSFULLY ===');
}

runQA().catch(err => {
  console.error('QA ERROR:', err);
  process.exit(1);
});
