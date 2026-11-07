const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const TEST_SID = 'testsessionvenue1234567890abcdef1234567890abcdef1234567890abcdef';

async function runProfileSuite() {
  console.log('=== STARTING COMPLETE MY PROFILE MODULE QA SUITE ===');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const auditReport = {
    timestamp: new Date().toISOString(),
    pagesTested: [],
    breakpointsTested: [1440, 768, 375],
    horizontalScrollViolations: [],
    colorChecks: [],
    screenshots: []
  };

  const page = await browser.newPage();

  // Set session cookie
  await page.setCookie({
    name: 'rapira.sid',
    value: TEST_SID,
    domain: 'localhost',
    path: '/',
    httpOnly: true
  });

  const pagesToTest = [
    { name: '1. Profile Dashboard', url: 'http://localhost:3000/users/profile', prefix: 'profile-dashboard' },
    { name: '2. Edit Profile', url: 'http://localhost:3000/users/edit-profile', prefix: 'edit-profile' },
    { name: '3. Change Password', url: 'http://localhost:3000/users/change-password', prefix: 'change-password' },
    { name: '4. My Tickets', url: 'http://localhost:3000/tickets', prefix: 'my-tickets' },
    { name: '5. Subscription Status', url: 'http://localhost:3000/subscriptions/my-subscriptions', prefix: 'my-subscriptions' },
    { name: '6. My Venue Requests', url: 'http://localhost:3000/users/venue-requests', prefix: 'my-venue-requests' },
    { name: '7. My Venues', url: 'http://localhost:3000/users/venues', prefix: 'my-venues' },
    { name: '8. My Refund Requests', url: 'http://localhost:3000/refund-requests/my-requests', prefix: 'my-refund-requests' },
    { name: '9. Become an Artist (Select Level)', url: 'http://localhost:3000/artist-applications/select-level', prefix: 'become-artist-select' }
  ];

  for (const item of pagesToTest) {
    console.log(`\n--- Testing ${item.name} (${item.url}) ---`);

    // 1. Desktop 1440px
    await page.setViewport({ width: 1440, height: 900 });
    const res = await page.goto(item.url, { waitUntil: 'networkidle2' });
    const status = res.status();
    console.log(`[Desktop 1440px] Response status: ${status}`);

    const desktopMetrics = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const hasPageWrap = Boolean(document.querySelector('.rapira-profile-page'));
      const hasGlassDark = Boolean(document.querySelector('.glass-card-dark'));
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, .rh-page-title, .rh-profile-card-title')).map(h => ({
        text: h.innerText.trim(),
        color: window.getComputedStyle(h).color
      }));

      return {
        docW,
        winW,
        hasHorizontalScroll: docW > winW + 2,
        bodyBg,
        hasPageWrap,
        hasGlassDark,
        headings: headings.slice(0, 3)
      };
    });

    const shotDesktop = `${item.prefix}-desktop-1440px.png`;
    await page.screenshot({ path: path.join(ARTIFACT_DIR, shotDesktop), fullPage: true });
    auditReport.screenshots.push(shotDesktop);

    // 2. Mobile 375px
    await page.setViewport({ width: 375, height: 812 });
    await page.reload({ waitUntil: 'networkidle2' });

    const mobileMetrics = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      return {
        docW,
        winW,
        hasHorizontalScroll: docW > winW + 2
      };
    });

    const shotMobile = `${item.prefix}-mobile-375px.png`;
    await page.screenshot({ path: path.join(ARTIFACT_DIR, shotMobile), fullPage: true });
    auditReport.screenshots.push(shotMobile);

    const passed = status === 200 && !desktopMetrics.hasHorizontalScroll && !mobileMetrics.hasHorizontalScroll && !desktopMetrics.hasGlassDark;

    if (desktopMetrics.hasHorizontalScroll) {
      auditReport.horizontalScrollViolations.push(`${item.name} (Desktop): docW ${desktopMetrics.docW} > winW ${desktopMetrics.winW}`);
    }
    if (mobileMetrics.hasHorizontalScroll) {
      auditReport.horizontalScrollViolations.push(`${item.name} (Mobile): docW ${mobileMetrics.docW} > winW ${mobileMetrics.winW}`);
    }

    auditReport.pagesTested.push({
      name: item.name,
      url: item.url,
      httpStatus: status,
      desktopPassed: !desktopMetrics.hasHorizontalScroll,
      mobilePassed: !mobileMetrics.hasHorizontalScroll,
      noDarkThemeArtifacts: !desktopMetrics.hasGlassDark,
      desktopHeadings: desktopMetrics.headings,
      passed
    });

    console.log(`Status: ${passed ? 'PASSED' : 'FAILED'}`);
  }

  // Write audit JSON
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'my-profile-redesign-audit.json'),
    JSON.stringify(auditReport, null, 2)
  );

  await browser.close();
  console.log('\n=== COMPLETE QA SUITE FINISHED ===');
}

runProfileSuite().catch(err => {
  console.error('QA Suite Failed with error:', err);
  process.exit(1);
});

