const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const TICKET_ID = '6aed6b3721b17fc127765f40';
const SESSION_COOKIE = '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f';

const VIEWPORTS = [
  { name: 'mobile-min-320px', width: 320, height: 600 },
  { name: 'mobile-small-360px', width: 360, height: 740 },
  { name: 'mobile-standard-375px', width: 375, height: 812 },
  { name: 'mobile-large-390px', width: 390, height: 844 },
  { name: 'mobile-plus-414px', width: 414, height: 896 },
  { name: 'mobile-max-430px', width: 430, height: 932 },
  { name: 'tablet-768px', width: 768, height: 1024 },
  { name: 'laptop-1024px', width: 1024, height: 768 },
  { name: 'desktop-wide-1440px', width: 1440, height: 900 }
];

async function verifyTicketConfirmation() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const qaResults = {
    ticketId: TICKET_ID,
    timestamp: new Date().toISOString(),
    viewports: [],
    assertions: {},
    passed: true
  };

  // Set session cookie
  await page.setCookie({
    name: 'rapira.sid',
    value: SESSION_COOKIE,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false
  });

  console.log(`Navigating to http://localhost:3000/tickets/${TICKET_ID}...`);
  await page.setViewport({ width: 1440, height: 900 });
  const response = await page.goto(`http://localhost:3000/tickets/${TICKET_ID}`, {
    waitUntil: 'networkidle2'
  });

  console.log(`HTTP Status: ${response.status()}`);
  if (response.status() !== 200) {
    throw new Error(`Unexpected status code: ${response.status()}`);
  }

  // 1. Test each viewport for horizontal overflow and element visibility
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 200));

    const vpMetrics = await page.evaluate((vpWidth) => {
      const docWidth = document.documentElement.scrollWidth;
      const bodyWidth = document.body.scrollWidth;
      const winWidth = window.innerWidth;
      const overflow = Math.max(0, docWidth - winWidth);

      const nav = document.querySelector('nav.navbar');
      const navBorderBottom = nav ? window.getComputedStyle(nav).borderBottom : '';
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const footer = document.querySelector('footer');
      const footerBg = footer ? window.getComputedStyle(footer).backgroundColor : '';
      const performerCard = document.querySelector('.rapira-performer-card');
      const crowdSilhouette = document.querySelector('.rapira-ticket-crowd-silhouette');

      return {
        winWidth,
        docWidth,
        bodyWidth,
        overflow,
        hasHorizontalScroll: overflow > 1,
        bodyBg,
        navBorderBottom,
        footerExists: !!footer,
        footerBg,
        performerCardExists: !!performerCard,
        crowdSilhouetteDisplay: crowdSilhouette ? window.getComputedStyle(crowdSilhouette).display : 'none'
      };
    }, vp.width);

    console.log(`Viewport ${vp.name} (${vp.width}x${vp.height}): Overflow=${vpMetrics.overflow}px, Scroll=${vpMetrics.hasHorizontalScroll}`);
    qaResults.viewports.push({
      ...vp,
      metrics: vpMetrics
    });

    if (vpMetrics.overflow > 1) {
      qaResults.passed = false;
    }
  }

  // 2. Detailed Desktop Inspection & Screenshot
  await page.setViewport({ width: 1440, height: 900 });
  await new Promise(r => setTimeout(r, 200));

  const desktopData = await page.evaluate(() => {
    const nav = document.querySelector('nav.navbar');
    const navStyle = window.getComputedStyle(nav);
    const bodyStyle = window.getComputedStyle(document.body);
    const mainStyle = window.getComputedStyle(document.querySelector('main'));
    const footer = document.querySelector('footer');
    const footerStyle = footer ? window.getComputedStyle(footer) : null;
    const performer = document.querySelector('.rapira-performer-card');
    const performerName = performer ? performer.querySelector('.rapira-performer-heading').innerText.trim() : null;
    const performerRole = performer ? performer.querySelector('.rapira-performer-tag').innerText.trim() : null;
    const drawerBtn = document.getElementById('rapiraReceiptToggleBtn');
    const drawerContent = document.getElementById('rapiraReceiptContent');

    return {
      bodyBg: bodyStyle.backgroundColor,
      navBg: navStyle.backgroundColor,
      navBorderBottom: navStyle.borderBottom,
      mainPadding: mainStyle.padding,
      footerBg: footerStyle ? footerStyle.backgroundColor : null,
      footerBorderTop: footerStyle ? footerStyle.borderTop : null,
      performerName,
      performerRole,
      hasDrawerBtn: !!drawerBtn,
      hasDrawerContent: !!drawerContent
    };
  });

  console.log('Desktop Data:', JSON.stringify(desktopData, null, 2));
  qaResults.assertions.desktop = desktopData;

  const desktopScreenshotPath = path.join(ARTIFACT_DIR, 'ticket-confirmation-desktop-1440px.png');
  await page.screenshot({ path: desktopScreenshotPath, fullPage: true });
  console.log(`Saved desktop screenshot: ${desktopScreenshotPath}`);

  // 3. Test Drawer Toggle Interaction
  console.log('Testing Payment Details Drawer toggle...');
  await page.click('#rapiraReceiptToggleBtn');
  await new Promise(r => setTimeout(r, 250));

  const drawerStateAfterClick = await page.evaluate(() => {
    const content = document.getElementById('rapiraReceiptContent');
    const style = window.getComputedStyle(content);
    return {
      isOpen: content.classList.contains('open'),
      display: style.display,
      paymentId: content.querySelector('.r-val') ? content.querySelector('.r-val').innerText.trim() : null
    };
  });
  console.log('Drawer State After Click:', drawerStateAfterClick);
  qaResults.assertions.drawerToggle = drawerStateAfterClick;

  const drawerScreenshotPath = path.join(ARTIFACT_DIR, 'ticket-payment-details-expanded.png');
  await page.screenshot({ path: drawerScreenshotPath, fullPage: false });

  // 4. Mobile 375px Inspection & Screenshot
  await page.setViewport({ width: 375, height: 812 });
  await new Promise(r => setTimeout(r, 200));

  const mobileScreenshotPath = path.join(ARTIFACT_DIR, 'ticket-confirmation-mobile-375px.png');
  await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
  console.log(`Saved mobile screenshot: ${mobileScreenshotPath}`);

  // Mobile Footer element screenshot
  const footerElem = await page.$('footer');
  if (footerElem) {
    const mobileFooterScreenshotPath = path.join(ARTIFACT_DIR, 'ticket-confirmation-footer-375px.png');
    await footerElem.screenshot({ path: mobileFooterScreenshotPath });
    console.log(`Saved mobile footer screenshot: ${mobileFooterScreenshotPath}`);
  }

  // Write verification JSON artifact
  const jsonPath = path.join(ARTIFACT_DIR, 'ticket-confirmation-verification.json');
  fs.writeFileSync(jsonPath, JSON.stringify(qaResults, null, 2));
  console.log(`Saved QA verification JSON: ${jsonPath}`);

  await browser.close();
  console.log('Verification script completed successfully.');
}

verifyTicketConfirmation().catch(err => {
  console.error('QA Verification failed:', err);
  process.exit(1);
});

