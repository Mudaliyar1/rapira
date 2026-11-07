const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const CONCERT_ID = '6aec50df716ae22e5aa1797f';
const SESSION_COOKIE = '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f';
const TARGET_URL = `http://localhost:3000/concerts/${CONCERT_ID}/select-quantity?step=seats&quantity=2`;

const VIEWPORTS = [
  { name: 'mobile-min-320px', width: 320, height: 600, isMobile: true },
  { name: 'mobile-small-360px', width: 360, height: 740, isMobile: true },
  { name: 'mobile-standard-375px', width: 375, height: 812, isMobile: true },
  { name: 'mobile-large-390px', width: 390, height: 844, isMobile: true },
  { name: 'mobile-plus-414px', width: 414, height: 896, isMobile: true },
  { name: 'mobile-max-430px', width: 430, height: 932, isMobile: true },
  { name: 'tablet-768px', width: 768, height: 1024, isMobile: true },
  { name: 'laptop-1024px', width: 1024, height: 768, isMobile: false },
  { name: 'desktop-wide-1440px', width: 1440, height: 900, isMobile: false }
];

async function runQA() {
  console.log('=== Starting Mobile Seat Selection QA Verification ===');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  const report = {
    timestamp: new Date().toISOString(),
    concertId: CONCERT_ID,
    url: TARGET_URL,
    viewports: [],
    passed: true
  };

  try {
    await page.setCookie({
      name: 'rapira.sid',
      value: SESSION_COOKIE,
      domain: 'localhost',
      path: '/'
    });

    for (const vp of VIEWPORTS) {
      console.log(`\nTesting viewport: ${vp.name} (${vp.width}x${vp.height})...`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });

      // Wait for seat map elements
      await page.waitForSelector('#seatMapViewport', { timeout: 8000 });
      await new Promise(r => setTimeout(r, 600));

      const vpMetrics = await page.evaluate((isMobile) => {
        const body = document.body;
        const html = document.documentElement;
        const vpEl = document.getElementById('seatMapViewport');
        const contentEl = document.getElementById('seatMapContent');
        const zoomIn = document.getElementById('zoomInBtn');
        const zoomOut = document.getElementById('zoomOutBtn');
        const zoomReset = document.getElementById('zoomResetBtn');
        const stickyBar = document.getElementById('mobileStickyBar');
        const checkoutBtn = document.getElementById('mobileProceedCheckoutBtn');
        const chatbot = document.querySelector('#chatbot-toggle, .chatbot-toggle');

        const docScrollWidth = html.scrollWidth;
        const bodyScrollWidth = body.scrollWidth;
        const winWidth = window.innerWidth;
        const hasBodyOverflow = (docScrollWidth > winWidth + 1) || (bodyScrollWidth > winWidth + 1);

        const vpRect = vpEl ? vpEl.getBoundingClientRect() : null;
        const contentRect = contentEl ? contentEl.getBoundingClientRect() : null;

        // Zoom button touch targets
        const zoomInRect = zoomIn ? zoomIn.getBoundingClientRect() : null;
        const zoomOutRect = zoomOut ? zoomOut.getBoundingClientRect() : null;
        const zoomResetRect = zoomReset ? zoomReset.getBoundingClientRect() : null;

        // Sticky bar & checkout button checks
        let stickyVisible = false;
        let checkoutWrapped = false;
        let checkoutHeight = 0;
        let checkoutWidth = 0;
        let btnText = '';
        let chatbotClearance = 0;

        if (isMobile && stickyBar) {
          const style = window.getComputedStyle(stickyBar);
          stickyVisible = (style.display !== 'none' && style.visibility !== 'hidden');
          if (checkoutBtn) {
            const btnRect = checkoutBtn.getBoundingClientRect();
            checkoutHeight = Math.round(btnRect.height);
            checkoutWidth = Math.round(btnRect.width);
            btnText = checkoutBtn.innerText.trim();
            // A wrapped button with padding would exceed 46px height
            checkoutWrapped = checkoutHeight > 48;
          }
        }

        if (chatbot && stickyBar && isMobile) {
          const botRect = chatbot.getBoundingClientRect();
          const barRect = stickyBar.getBoundingClientRect();
          chatbotClearance = barRect.top - botRect.bottom;
        }

        return {
          winWidth,
          docScrollWidth,
          bodyScrollWidth,
          hasBodyOverflow,
          seatViewport: {
            clientWidth: vpEl ? vpEl.clientWidth : 0,
            scrollWidth: vpEl ? vpEl.scrollWidth : 0,
            left: vpRect ? Math.round(vpRect.left) : 0,
            width: vpRect ? Math.round(vpRect.width) : 0
          },
          seatContent: {
            left: contentRect ? Math.round(contentRect.left) : 0,
            width: contentRect ? Math.round(contentRect.width) : 0
          },
          zoomButtons: {
            inWidth: zoomInRect ? Math.round(zoomInRect.width) : 0,
            inHeight: zoomInRect ? Math.round(zoomInRect.height) : 0,
            resetWidth: zoomResetRect ? Math.round(zoomResetRect.width) : 0,
            resetHeight: zoomResetRect ? Math.round(zoomResetRect.height) : 0
          },
          stickyBar: {
            visible: stickyVisible,
            checkoutBtnHeight: checkoutHeight,
            checkoutBtnWidth: checkoutWidth,
            checkoutWrapped,
            btnText
          },
          chatbotClearance
        };
      }, vp.isMobile);

      console.log(`- Page horizontal overflow: ${vpMetrics.hasBodyOverflow ? 'FAIL (spill detected)' : 'PASS (0px overflow)'}`);
      console.log(`- Seat viewport scrollWidth: ${vpMetrics.seatViewport.scrollWidth}px, clientWidth: ${vpMetrics.seatViewport.clientWidth}px`);
      if (vp.isMobile) {
        console.log(`- Sticky Checkout button: "${vpMetrics.stickyBar.btnText}", height: ${vpMetrics.stickyBar.checkoutBtnHeight}px, wrapped: ${vpMetrics.stickyBar.checkoutWrapped ? 'FAIL' : 'PASS'}`);
        console.log(`- Chatbot clearance above sticky bar: ${vpMetrics.chatbotClearance}px`);
        console.log(`- Zoom touch targets: ${vpMetrics.zoomButtons.inWidth}x${vpMetrics.zoomButtons.inHeight}px`);
      }

      const vpPass = !vpMetrics.hasBodyOverflow && (!vp.isMobile || !vpMetrics.stickyBar.checkoutWrapped);
      if (!vpPass) report.passed = false;

      report.viewports.push({
        name: vp.name,
        width: vp.width,
        height: vp.height,
        metrics: vpMetrics,
        passed: vpPass
      });

      // Capture screenshots for representative breakpoints
      if (['mobile-min-320px', 'mobile-standard-375px', 'mobile-large-390px', 'mobile-max-430px', 'desktop-wide-1440px'].includes(vp.name)) {
        const shotPath = path.join(ARTIFACT_DIR, `seat-selection-${vp.name}.png`);
        await page.screenshot({ path: shotPath, fullPage: false });
        console.log(`  -> Saved screenshot: ${shotPath}`);
      }

      // Special check: Scroll to bottom at 375px to verify footer clearance
      if (vp.name === 'mobile-standard-375px') {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 400));
        const footerShot = path.join(ARTIFACT_DIR, 'seat-selection-footer-clear-375px.png');
        await page.screenshot({ path: footerShot, fullPage: false });
        console.log(`  -> Saved footer clearance screenshot: ${footerShot}`);
      }
    }

    // Verify Zoom Controls Functionality
    console.log('\nTesting Zoom Controls Interactive Behavior...');
    await page.setViewport({ width: 375, height: 812 });
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#zoomInBtn');

    // Click Zoom In
    await page.click('#zoomInBtn');
    await new Promise(r => setTimeout(r, 200));
    const zoomedInTransform = await page.$eval('#seatMapContent', el => el.style.transform);
    console.log(`- Zoom In transform: ${zoomedInTransform}`);

    // Click Zoom Reset (Fit)
    await page.click('#zoomResetBtn');
    await new Promise(r => setTimeout(r, 300));
    const resetTransform = await page.$eval('#seatMapContent', el => el.style.transform);
    const scrollPos = await page.$eval('#seatMapViewport', el => ({
      scrollLeft: el.scrollLeft,
      maxScroll: el.scrollWidth - el.clientWidth
    }));
    console.log(`- Zoom Reset transform: ${resetTransform}, scrollLeft: ${scrollPos.scrollLeft}/${scrollPos.maxScroll}`);

    // Save QA report
    const reportPath = path.join(ARTIFACT_DIR, 'mobile-seat-selection-qa.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nQA Report saved to: ${reportPath}`);
    console.log(`Overall QA Result: ${report.passed ? 'PASSED ALL CHECKS' : 'FAILED CHECKS'}`);

  } finally {
    await browser.close();
  }
}

runQA().catch(err => {
  console.error('QA Error:', err);
  process.exit(1);
});

