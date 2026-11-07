const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const CONCERT_ID = '6aec50df716ae22e5aa1797f';
const SESSION_COOKIE = '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f';

const TEST_VIEWPORTS = [
  { name: 'mobile-320px', width: 320, height: 600 },
  { name: 'mobile-360px', width: 360, height: 740 },
  { name: 'mobile-375px', width: 375, height: 812 },
  { name: 'mobile-390px', width: 390, height: 844 },
  { name: 'mobile-414px', width: 414, height: 896 },
  { name: 'mobile-430px', width: 430, height: 932 },
  { name: 'tablet-768px', width: 768, height: 1024 },
  { name: 'laptop-1024px', width: 1024, height: 768 },
  { name: 'desktop-1280px', width: 1280, height: 800 },
  { name: 'desktop-1440px', width: 1440, height: 900 }
];

async function runMobileResponsiveSuite() {
  console.log('[RESPONSIVE AUDIT] Launching verification browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  await page.setCookie({
    name: 'rapira.sid',
    value: SESSION_COOKIE,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false
  });

  const report = {
    timestamp: new Date().toISOString(),
    viewports: [],
    navbarVerification: {},
    checkoutLayoutVerification: {},
    footerVerification: {},
    allPassed: true
  };

  const bookingUrl = `http://localhost:3000/concerts/${CONCERT_ID}/book?quantity=2&seats=A-01,A-02&category=recliner`;

  console.log(`[RESPONSIVE AUDIT] 1. Testing viewports for 0px horizontal overflow across: ${bookingUrl}`);

  for (const vp of TEST_VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(bookingUrl, { waitUntil: 'networkidle2' });

    const metrics = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      const bodyWidth = document.body.scrollWidth;
      const nav = document.querySelector('nav.navbar');
      const navWidth = nav ? nav.offsetWidth : 0;
      const main = document.querySelector('main');
      const mainPadding = main ? window.getComputedStyle(main).padding : '0';

      return {
        docWidth,
        winWidth,
        bodyWidth,
        navWidth,
        mainPadding,
        hasOverflow: docWidth > winWidth
      };
    });

    const passed = !metrics.hasOverflow;
    if (!passed) report.allPassed = false;

    console.log(`[VIEWPORT ${vp.name}] Width: ${vp.width}px | ScrollWidth: ${metrics.docWidth}px | Overflow: ${metrics.hasOverflow ? 'FAIL' : 'PASS (0px)'}`);

    report.viewports.push({
      viewport: vp.name,
      width: vp.width,
      height: vp.height,
      scrollWidth: metrics.docWidth,
      hasOverflow: metrics.hasOverflow,
      passed
    });
  }

  // Detailed Verification at 375px (Mobile Standard)
  console.log('[RESPONSIVE AUDIT] 2. Verifying mobile 375px layout details...');
  await page.setViewport({ width: 375, height: 812 });
  await page.goto(bookingUrl, { waitUntil: 'networkidle2' });

  const mobileDetails = await page.evaluate(() => {
    const nav = document.querySelector('nav.navbar');
    const brand = document.querySelector('.navbar-brand span, .rapira-nav-brand-crimson');
    const toggler = document.querySelector('.navbar-toggler');
    const togglerIcon = document.querySelector('.navbar-toggler-icon');
    const attendeeRow = document.querySelector('.rapira-attendee-row');
    const nameField = document.querySelector('.field-name');
    const ageField = document.querySelector('.field-age');
    const nameInp = document.querySelector('#attendeeName0');
    const ageInp = document.querySelector('#attendeeAge0');

    // DOM order check inside form
    const form = document.querySelector('#razorpayForm, #freeConcertForm');
    const children = form ? Array.from(form.children).map(c => c.getAttribute('aria-label') || c.className) : [];
    
    // Check positions of Instructions vs Mobile Summary
    const instructionsEl = form ? form.querySelector('[aria-label="Payment Instructions"]') : null;
    const mobileSummaryEl = form ? form.querySelector('[aria-label="Mobile Price Summary"]') : null;
    const checkboxEl = form ? form.querySelector('.rapira-agreement-card') : null;
    const buttonEl = form ? form.querySelector('#proceedPaymentBtn') : null;

    let isSummaryBelowInstructions = false;
    if (instructionsEl && mobileSummaryEl) {
      isSummaryBelowInstructions = (instructionsEl.compareDocumentPosition(mobileSummaryEl) & Node.DOCUMENT_POSITION_FOLLOWING) > 0;
    }

    let isCheckboxBelowSummary = false;
    if (mobileSummaryEl && checkboxEl) {
      isCheckboxBelowSummary = (mobileSummaryEl.compareDocumentPosition(checkboxEl) & Node.DOCUMENT_POSITION_FOLLOWING) > 0;
    }

    const footer = document.querySelector('footer.rapira-site-footer');
    const footerBg = footer ? window.getComputedStyle(footer).backgroundColor : null;
    const footerBrand = footer ? footer.querySelector('.footer-brand') : null;
    const footerCols = footer ? Array.from(footer.querySelectorAll('.rapira-footer-col, [class*="col-"]')).map(c => ({
      width: c.offsetWidth,
      display: window.getComputedStyle(c).display,
      float: window.getComputedStyle(c).float
    })) : [];

    return {
      navBg: nav ? window.getComputedStyle(nav).backgroundColor : null,
      brandColor: brand ? window.getComputedStyle(brand).color : null,
      togglerDisplay: toggler ? window.getComputedStyle(toggler).display : null,
      rowFlexDirection: attendeeRow ? window.getComputedStyle(attendeeRow).flexDirection : null,
      nameFieldWidth: nameField ? nameField.offsetWidth : null,
      ageFieldWidth: ageField ? ageField.offsetWidth : null,
      nameFieldTop: nameField ? nameField.offsetTop : null,
      ageFieldTop: ageField ? ageField.offsetTop : null,
      isInputsStacked: ageField && nameField ? ageField.offsetTop > nameField.offsetTop : false,
      isSummaryBelowInstructions,
      isCheckboxBelowSummary,
      footerBg,
      footerBrandColor: footerBrand ? window.getComputedStyle(footerBrand).color : null,
      footerColsCount: footerCols.length,
      footerColWidths: footerCols.map(c => c.width)
    };
  });

  report.checkoutLayoutVerification = {
    inputsStackedVertically: mobileDetails.isInputsStacked,
    rowFlexDirection: mobileDetails.rowFlexDirection,
    summaryBelowInstructions: mobileDetails.isSummaryBelowInstructions,
    checkboxBelowSummary: mobileDetails.isCheckboxBelowSummary
  };

  report.navbarVerification = {
    navBg: mobileDetails.navBg,
    brandColor: mobileDetails.brandColor,
    togglerVisible: mobileDetails.togglerDisplay !== 'none'
  };

  report.footerVerification = {
    footerBg: mobileDetails.footerBg,
    brandColor: mobileDetails.footerBrandColor,
    mobileVerticalStacking: mobileDetails.footerColWidths.every(w => w > 300) // All cols full width on 375px
  };

  console.log('[RESPONSIVE AUDIT] Mobile Details at 375px:', JSON.stringify(report, null, 2));

  // Capture Mobile Checkout Screenshot
  const mobileCheckoutPath = path.join(ARTIFACT_DIR, 'mobile-checkout-375px.png');
  await page.screenshot({ path: mobileCheckoutPath, fullPage: true });
  console.log(`[RESPONSIVE AUDIT] Saved mobile-checkout-375px.png to artifacts`);

  // Capture Mobile Navbar Open Drawer Screenshot
  console.log('[RESPONSIVE AUDIT] 3. Testing and capturing Mobile Navbar open state...');
  await page.click('.navbar-toggler');
  await new Promise(r => setTimeout(r, 600)); // wait for collapse animation
  const mobileNavPath = path.join(ARTIFACT_DIR, 'mobile-navbar-open-375px.png');
  await page.screenshot({ path: mobileNavPath });
  console.log(`[RESPONSIVE AUDIT] Saved mobile-navbar-open-375px.png to artifacts`);

  // Capture Mobile Footer Screenshot
  console.log('[RESPONSIVE AUDIT] 4. Capturing Mobile Footer at 375px...');
  await page.evaluate(() => {
    const footer = document.querySelector('footer.rapira-site-footer');
    if (footer) footer.scrollIntoView();
  });
  await new Promise(r => setTimeout(r, 300));
  const mobileFooterPath = path.join(ARTIFACT_DIR, 'mobile-footer-375px.png');
  const footerEl = await page.$('footer.rapira-site-footer');
  if (footerEl) {
    await footerEl.screenshot({ path: mobileFooterPath });
    console.log(`[RESPONSIVE AUDIT] Saved mobile-footer-375px.png to artifacts`);
  }

  // Capture Desktop 1440px Checkout & Multi-column Footer
  console.log('[RESPONSIVE AUDIT] 5. Capturing Desktop 1440px Checkout & Multi-column Footer...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(bookingUrl, { waitUntil: 'networkidle2' });
  const desktopCheckoutPath = path.join(ARTIFACT_DIR, 'desktop-checkout-1440px.png');
  await page.screenshot({ path: desktopCheckoutPath, fullPage: true });
  console.log(`[RESPONSIVE AUDIT] Saved desktop-checkout-1440px.png to artifacts`);

  // Save JSON report to artifact dir
  const reportPath = path.join(ARTIFACT_DIR, 'mobile-responsive-verification.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[RESPONSIVE AUDIT] Verification report saved to ${reportPath}`);

  await browser.close();
  return report;
}

runMobileResponsiveSuite()
  .then(res => {
    console.log('[RESPONSIVE AUDIT] Verification Suite completed successfully. All passed:', res.allPassed);
  })
  .catch(err => {
    console.error('[RESPONSIVE AUDIT] Fatal error:', err);
    process.exit(1);
  });

