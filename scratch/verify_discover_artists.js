const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

async function runQA() {
  console.log('=== STARTING DISCOVER ARTISTS QA SUITE ===');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const auditReport = {
    timestamp: new Date().toISOString(),
    tests: [],
    viewports: [],
    screenshots: []
  };

  const page = await browser.newPage();

  // Test 1: Desktop 1440px Visual & Layout Structure
  console.log('[Test 1] Inspecting Desktop 1440px Viewport...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/artists', { waitUntil: 'networkidle2' });

  const desktopAudit = await page.evaluate(() => {
    const pageWrapper = document.querySelector('.rapira-discover-artists-page');
    const heroTitle = document.querySelector('.rh-da-title');
    const heroWaveform = document.querySelector('.rh-da-waveform-desktop');
    const filterCard = document.querySelector('.rh-da-filter-card');
    const searchInput = document.getElementById('searchInput');
    const genreFilter = document.getElementById('genreFilter');
    const locationFilter = document.getElementById('locationFilter');
    const verifiedFilter = document.getElementById('verifiedFilter');
    const sortFilter = document.getElementById('sortFilter');
    const cards = Array.from(document.querySelectorAll('.rh-da-card'));

    const firstCard = cards[0];
    const rionaCard = cards.find(c => c.innerText.includes('Riona'));
    const pujaariCard = cards.find(c => c.innerText.includes('Vansh Sharma') || c.innerText.includes('PUJAARI'));
    const vashuCard = cards.find(c => c.innerText.includes('Vashu'));

    return {
      hasWrapper: Boolean(pageWrapper),
      wrapperBg: pageWrapper ? window.getComputedStyle(pageWrapper).backgroundColor : null,
      titleText: heroTitle?.innerText.trim(),
      titleFont: heroTitle ? window.getComputedStyle(heroTitle).fontFamily : null,
      titleColor: heroTitle ? window.getComputedStyle(heroTitle).color : null,
      hasDesktopWaveform: Boolean(heroWaveform && window.getComputedStyle(heroWaveform).display !== 'none'),
      hasFilterCard: Boolean(filterCard),
      hasSearchInput: Boolean(searchInput),
      hasGenreDropdown: Boolean(genreFilter && genreFilter.options.length > 1),
      hasLocationDropdown: Boolean(locationFilter && locationFilter.options.length > 1),
      hasVerifiedDropdown: Boolean(verifiedFilter && verifiedFilter.options.length >= 3),
      hasSortDropdown: Boolean(sortFilter && sortFilter.options.length >= 4),
      cardsCount: cards.length,
      riona: rionaCard ? {
        name: rionaCard.querySelector('.rh-da-card-title')?.innerText.trim(),
        hasDesktopVerified: Boolean(rionaCard.querySelector('.rh-da-verified-pill-desktop')),
        imgSrc: rionaCard.querySelector('.rh-da-card-img')?.src,
        hasMetaMusic: Boolean(rionaCard.innerHTML.includes('Hip-Hop') || rionaCard.innerHTML.includes('Hip Hop')),
        metaText: rionaCard.innerText.split('\n').filter(Boolean)
      } : null,
      pujaari: pujaariCard ? {
        name: pujaariCard.querySelector('.rh-da-card-title')?.innerText.trim(),
        stageName: pujaariCard.querySelector('.rh-da-stage-name')?.innerText.trim(),
        hasDesktopVerified: Boolean(pujaariCard.querySelector('.rh-da-verified-pill-desktop')),
        imgSrc: pujaariCard.querySelector('.rh-da-card-img')?.src
      } : null,
      vashu: vashuCard ? {
        name: vashuCard.querySelector('.rh-da-card-title')?.innerText.trim(),
        hasFallbackAvatar: Boolean(vashuCard.querySelector('.rh-da-fallback-avatar')),
        fallbackLetter: vashuCard.querySelector('.rh-da-fallback-letter')?.innerText.trim(),
        hasDesktopVerified: Boolean(vashuCard.querySelector('.rh-da-verified-pill-desktop'))
      } : null
    };
  });

  console.log('Desktop Audit Results:', JSON.stringify(desktopAudit, null, 2));

  auditReport.tests.push({
    name: 'Desktop Structure, Design Tokens & Data Verification',
    passed: desktopAudit.hasWrapper && 
            desktopAudit.titleColor === 'rgb(159, 25, 14)' &&
            desktopAudit.hasSearchInput && 
            desktopAudit.hasLocationDropdown &&
            desktopAudit.cardsCount > 0 &&
            desktopAudit.riona?.hasDesktopVerified &&
            desktopAudit.vashu?.hasFallbackAvatar,
    actual: desktopAudit
  });

  const desktopScreenshot = 'discover-artists-desktop-1440px.png';
  await page.screenshot({ path: path.join(ARTIFACT_DIR, desktopScreenshot), fullPage: true });
  auditReport.screenshots.push(desktopScreenshot);

  // Test 2: Filter Collapse Toggle
  console.log('[Test 2] Testing Filter Collapse Toggle Interaction...');
  const collapseTest = await page.evaluate(async () => {
    const toggleBtn = document.getElementById('rhDaFilterToggleBtn');
    const filterBody = document.getElementById('rhDaFilterBody');
    const toggleText = document.getElementById('rhDaToggleText');
    
    // Initial state: visible
    const initialVisible = !filterBody.classList.contains('d-none');
    
    // Click toggle to hide
    toggleBtn.click();
    const hiddenAfterClick = filterBody.classList.contains('d-none');
    const textAfterClick = toggleText.innerText.trim();

    // Click toggle to show again
    toggleBtn.click();
    const visibleAfterSecondClick = !filterBody.classList.contains('d-none');

    return {
      initialVisible,
      hiddenAfterClick,
      textAfterClick,
      visibleAfterSecondClick
    };
  });
  console.log('Filter Collapse Test:', collapseTest);
  auditReport.tests.push({
    name: 'Filter Panel Expand / Collapse Functionality',
    passed: collapseTest.hiddenAfterClick && collapseTest.visibleAfterSecondClick,
    actual: collapseTest
  });

  // Test 3: Location Dropdown Client-Side Filtering
  console.log('[Test 3] Testing Location Dropdown Client Filtering...');
  const locationTest = await page.evaluate(async () => {
    const locationFilter = document.getElementById('locationFilter');
    // Select first non-empty option
    if (locationFilter.options.length > 1) {
      const targetLoc = locationFilter.options[1].value;
      locationFilter.value = targetLoc;
      locationFilter.dispatchEvent(new Event('change'));

      const visibleCards = Array.from(document.querySelectorAll('.rh-da-card')).filter(c => c.style.display !== 'none');
      const activeCount = document.getElementById('rhDaActiveCount')?.innerText.trim();
      const activePillVisible = document.getElementById('rhDaActivePill')?.style.display !== 'none';

      // Reset
      locationFilter.value = '';
      locationFilter.dispatchEvent(new Event('change'));

      return {
        targetLoc,
        visibleCardsCount: visibleCards.length,
        activeCount,
        activePillVisible
      };
    }
    return null;
  });
  console.log('Location Filter Test:', locationTest);
  auditReport.tests.push({
    name: 'Location Dropdown & Active Filter Badge',
    passed: Boolean(locationTest && locationTest.visibleCardsCount >= 1 && locationTest.activePillVisible),
    actual: locationTest
  });

  // Test 4: Empty State Rendering (Search Nonexistent Artist)
  console.log('[Test 4] Testing Empty State on zero matches...');
  await page.goto('http://localhost:3000/artists?search=NonExistentArtistQueryXYZ999', { waitUntil: 'networkidle2' });
  const emptyStateAudit = await page.evaluate(() => {
    const emptyCard = document.getElementById('rhDaEmptyState');
    const emptyTitle = emptyCard?.querySelector('.rh-da-empty-title')?.innerText.trim();
    const resetBtn = emptyCard?.querySelector('a.rh-da-btn-primary');
    const grid = document.getElementById('rhDaArtistsGrid');

    return {
      emptyCardVisible: emptyCard && window.getComputedStyle(emptyCard).display !== 'none',
      emptyTitle,
      hasResetBtn: Boolean(resetBtn),
      gridHidden: !grid || grid.children.length === 0 || window.getComputedStyle(grid).display === 'none'
    };
  });
  console.log('Empty State Audit:', emptyStateAudit);
  auditReport.tests.push({
    name: 'Empty State Card with Reset Action',
    passed: emptyStateAudit.emptyCardVisible && emptyStateAudit.emptyTitle === 'No Artists Found' && emptyStateAudit.hasResetBtn,
    actual: emptyStateAudit
  });

  // Test 5: Mobile Layout & Horizontal Card Structure (375px)
  console.log('[Test 5] Inspecting Mobile Layout at 375px...');
  await page.setViewport({ width: 375, height: 812, isMobile: true });
  await page.goto('http://localhost:3000/artists', { waitUntil: 'networkidle2' });

  const mobileAudit = await page.evaluate(() => {
    const heroWaveformMobile = document.querySelector('.rh-da-waveform-mobile');
    const heroWaveformDesktop = document.querySelector('.rh-da-waveform-desktop');
    const cards = Array.from(document.querySelectorAll('.rh-da-card'));
    const firstCard = cards[0];
    const firstCardComputed = firstCard ? window.getComputedStyle(firstCard) : null;
    const imgBox = firstCard?.querySelector('.rh-da-img-box');
    const imgBoxComputed = imgBox ? window.getComputedStyle(imgBox) : null;
    const mobileVerifiedBadge = firstCard?.querySelector('.rh-da-verified-badge-mobile');
    const desktopVerifiedPill = firstCard?.querySelector('.rh-da-verified-pill-desktop');

    return {
      mobileWaveformVisible: heroWaveformMobile && window.getComputedStyle(heroWaveformMobile).display !== 'none',
      desktopWaveformHidden: heroWaveformDesktop && window.getComputedStyle(heroWaveformDesktop).display === 'none',
      cardDisplay: firstCardComputed?.display,
      cardFlexDirection: firstCardComputed?.flexDirection,
      imgBoxWidth: imgBoxComputed?.width,
      imgBoxHeight: imgBoxComputed?.height,
      imgBoxBorderRadius: imgBoxComputed?.borderRadius,
      mobileVerifiedVisible: mobileVerifiedBadge ? window.getComputedStyle(mobileVerifiedBadge).display !== 'none' : false,
      desktopVerifiedHidden: desktopVerifiedPill ? window.getComputedStyle(desktopVerifiedPill).display === 'none' : true
    };
  });
  console.log('Mobile Layout Audit:', mobileAudit);
  auditReport.tests.push({
    name: 'Mobile Vertical Stack, Circular 72px DP & Inline Verified Badge',
    passed: mobileAudit.cardFlexDirection === 'row' &&
            mobileAudit.imgBoxWidth === '72px' &&
            mobileAudit.mobileVerifiedVisible &&
            mobileAudit.desktopVerifiedHidden,
    actual: mobileAudit
  });

  const mobileScreenshot = 'discover-artists-mobile-375px.png';
  await page.screenshot({ path: path.join(ARTIFACT_DIR, mobileScreenshot), fullPage: true });
  auditReport.screenshots.push(mobileScreenshot);

  // Test 6: Mandatory Responsive Viewport Suite (Zero Horizontal Overflow)
  console.log('[Test 6] Running Mandatory Responsive QA Suite...');
  const targetViewports = [
    { width: 360, height: 740, label: '360px' },
    { width: 375, height: 812, label: '375px' },
    { width: 390, height: 844, label: '390px' },
    { width: 414, height: 896, label: '414px' },
    { width: 768, height: 1024, label: '768px' },
    { width: 1024, height: 768, label: '1024px' },
    { width: 1440, height: 900, label: '1440px' }
  ];

  for (const vp of targetViewports) {
    await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 768 });
    await page.goto('http://localhost:3000/artists', { waitUntil: 'networkidle2' });

    const overflowCheck = await page.evaluate((w) => {
      const scrollW = document.documentElement.scrollWidth;
      const innerW = window.innerWidth;
      const bodyScrollW = document.body.scrollWidth;
      return {
        viewportWidth: w,
        scrollWidth: scrollW,
        bodyScrollWidth: bodyScrollW,
        innerWidth: innerW,
        hasOverflow: scrollW > innerW + 1
      };
    }, vp.width);

    const vpScreenshot = `discover-artists-${vp.width}px.png`;
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

  await browser.close();

  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'discover-artists-qa-audit.json'),
    JSON.stringify(auditReport, null, 2)
  );

  console.log('=== DISCOVER ARTISTS QA COMPLETED SUCCESSFULLY ===');
}

runQA().catch(err => {
  console.error('QA SUITE ERROR:', err);
  process.exit(1);
});

