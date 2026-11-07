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

async function runQA() {
  console.log('Starting Ticket Confirmation QA Bugfix Verification...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const results = {
    ticketId: TICKET_ID,
    timestamp: new Date().toISOString(),
    viewports: [],
    performerCardChecks: {},
    headerAlignmentChecks: {},
    rawBackendDataFound: false,
    passed: true
  };

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
    throw new Error(`Failed to load page: status ${response.status()}`);
  }

  // Check 1: Check for raw backend data anywhere in the page
  const pageContent = await page.content();
  const rawDataPatterns = [
    'contactPerson',
    'pricing',
    'ticketPricing',
    'venueType',
    'facilities',
    'new ObjectId',
    'hourlyRates',
    'lastUpdatedBy'
  ];

  const foundPatterns = rawDataPatterns.filter(pattern => {
    // Exclude script tags if any, check visible text
    return pageContent.includes(pattern);
  });

  // Specifically check performer card text
  const performerText = await page.evaluate(() => {
    const card = document.querySelector('.rapira-performer-card');
    return card ? card.innerText : '';
  });

  const rawPatternsInCard = rawDataPatterns.filter(p => performerText.includes(p));

  console.log('Performer Card Visible Text:', JSON.stringify(performerText));
  console.log('Raw Data Patterns in Card:', rawPatternsInCard);

  results.rawBackendDataFound = rawPatternsInCard.length > 0;
  if (results.rawBackendDataFound) {
    results.passed = false;
  }

  // Check 2: Detailed Performer Card Inspection
  const performerDetails = await page.evaluate(() => {
    const card = document.querySelector('.rapira-performer-card');
    if (!card) return null;

    const img = card.querySelector('.rapira-performer-avatar-img');
    const name = card.querySelector('.rapira-performer-heading');
    const tag = card.querySelector('.rapira-performer-tag');
    const genre = card.querySelector('.rapira-performer-genre-chip');
    const btn = card.querySelector('.rapira-performer-btn');

    const cardRect = card.getBoundingClientRect();
    const btnRect = btn ? btn.getBoundingClientRect() : null;
    const nameRect = name ? name.getBoundingClientRect() : null;

    // Check overlap between name and button
    let overlaps = false;
    if (btnRect && nameRect) {
      overlaps = !(nameRect.right < btnRect.left || nameRect.left > btnRect.right || nameRect.bottom < btnRect.top || nameRect.top > btnRect.bottom);
    }

    return {
      exists: true,
      imageSrc: img ? img.src : null,
      name: name ? name.innerText.trim() : null,
      tag: tag ? tag.innerText.trim() : null,
      genre: genre ? genre.innerText.trim() : null,
      btnText: btn ? btn.innerText.trim() : null,
      btnHref: btn ? btn.getAttribute('href') : null,
      cardWidth: cardRect.width,
      overlaps
    };
  });

  console.log('Performer Card Details:', JSON.stringify(performerDetails, null, 2));
  results.performerCardChecks = performerDetails;

  // Check 3: Header Alignment Inspection on Desktop
  const headerAlignmentDesktop = await page.evaluate(() => {
    const badge = document.querySelector('.rapira-scalloped-badge');
    const title = document.querySelector('.rapira-confirmed-title');
    const rays = document.querySelectorAll('.rapira-celebration-rays');
    const headerRow = document.querySelector('.rapira-confirmed-header-row');

    if (!badge || !title) return null;

    const badgeRect = badge.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();

    const badgeCenterY = badgeRect.top + badgeRect.height / 2;
    const titleCenterY = titleRect.top + titleRect.height / 2;
    const verticalCenterDiff = Math.abs(badgeCenterY - titleCenterY);

    return {
      badgeTop: badgeRect.top,
      badgeHeight: badgeRect.height,
      badgeCenterY,
      titleTop: titleRect.top,
      titleHeight: titleRect.height,
      titleCenterY,
      verticalCenterDiff,
      isVerticallyCentered: verticalCenterDiff < 6, // within 6px threshold
      raysCount: rays.length,
      headerRowDisplay: headerRow ? window.getComputedStyle(headerRow).display : null
    };
  });

  console.log('Header Alignment (Desktop):', JSON.stringify(headerAlignmentDesktop, null, 2));
  results.headerAlignmentChecks.desktop = headerAlignmentDesktop;

  // Capture Desktop Screenshots
  await page.setViewport({ width: 1440, height: 900 });
  await new Promise(r => setTimeout(r, 200));

  const desktopScreenshot = path.join(ARTIFACT_DIR, 'ticket-confirmation-desktop-1440px.png');
  await page.screenshot({ path: desktopScreenshot, fullPage: true });

  const headerElem = await page.$('.rapira-confirmed-wrap');
  if (headerElem) {
    const headerScreenshot = path.join(ARTIFACT_DIR, 'ticket-header-aligned-desktop.png');
    await headerElem.screenshot({ path: headerScreenshot });
    console.log(`Saved desktop header screenshot: ${headerScreenshot}`);
  }

  const performerElem = await page.$('.rapira-performer-card');
  if (performerElem) {
    const performerScreenshot = path.join(ARTIFACT_DIR, 'ticket-performer-clean-desktop.png');
    await performerElem.screenshot({ path: performerScreenshot });
    console.log(`Saved desktop performer screenshot: ${performerScreenshot}`);
  }

  // Check 4: Viewport Overflow & Responsive Behavior
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 200));

    const vpMetrics = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const bodyWidth = document.body.scrollWidth;
      const winWidth = window.innerWidth;
      const overflow = Math.max(0, docWidth - winWidth);

      const badge = document.querySelector('.rapira-scalloped-badge');
      const title = document.querySelector('.rapira-confirmed-title');
      const card = document.querySelector('.rapira-performer-card');
      const btn = card ? card.querySelector('.rapira-performer-btn') : null;
      const name = card ? card.querySelector('.rapira-performer-heading') : null;

      let btnOverlapsName = false;
      if (btn && name) {
        const bRect = btn.getBoundingClientRect();
        const nRect = name.getBoundingClientRect();
        btnOverlapsName = !(nRect.right < bRect.left || nRect.left > bRect.right || nRect.bottom < bRect.top || nRect.top > bRect.bottom);
      }

      let headerAlignment = null;
      if (badge && title) {
        const bRect = badge.getBoundingClientRect();
        const tRect = title.getBoundingClientRect();
        const bCenterY = bRect.top + bRect.height / 2;
        const tCenterY = tRect.top + tRect.height / 2;
        headerAlignment = {
          verticalCenterDiff: Math.abs(bCenterY - tCenterY)
        };
      }

      return {
        overflow,
        hasHorizontalScroll: overflow > 1,
        btnOverlapsName,
        headerAlignment
      };
    });

    console.log(`Viewport ${vp.name} (${vp.width}x${vp.height}): Overflow=${vpMetrics.overflow}px, Overlap=${vpMetrics.btnOverlapsName}`);
    results.viewports.push({
      ...vp,
      ...vpMetrics
    });

    if (vpMetrics.overflow > 1 || vpMetrics.btnOverlapsName) {
      results.passed = false;
    }
  }

  // Capture Mobile Screenshots (375px)
  await page.setViewport({ width: 375, height: 812 });
  await new Promise(r => setTimeout(r, 200));

  const mobileScreenshot = path.join(ARTIFACT_DIR, 'ticket-confirmation-mobile-375px.png');
  await page.screenshot({ path: mobileScreenshot, fullPage: true });

  const mobileHeaderElem = await page.$('.rapira-confirmed-wrap');
  if (mobileHeaderElem) {
    const mobileHeaderScreenshot = path.join(ARTIFACT_DIR, 'ticket-header-aligned-mobile.png');
    await mobileHeaderElem.screenshot({ path: mobileHeaderScreenshot });
    console.log(`Saved mobile header screenshot: ${mobileHeaderScreenshot}`);
  }

  const mobilePerformerElem = await page.$('.rapira-performer-card');
  if (mobilePerformerElem) {
    const mobilePerformerScreenshot = path.join(ARTIFACT_DIR, 'ticket-performer-clean-mobile.png');
    await mobilePerformerElem.screenshot({ path: mobilePerformerScreenshot });
    console.log(`Saved mobile performer screenshot: ${mobilePerformerScreenshot}`);
  }

  // Save QA JSON
  const jsonPath = path.join(ARTIFACT_DIR, 'ticket-confirmation-bugfix-qa.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`Saved QA results: ${jsonPath}`);

  await browser.close();
  console.log('All QA checks completed successfully!');
}

runQA().catch(err => {
  console.error('QA run failed:', err);
  process.exit(1);
});

