const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const ARTISTS_URL = 'http://localhost:3000/artists';

async function runArtistsFilterQA() {
  console.log('[QA] Starting Discover Artists Filter QA...');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_artists_qa_'));

  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tempDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    // ── 1. Desktop Test (1440x900) ──
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    console.log('[QA] Desktop: Loading artists page...');
    await page.goto(ARTISTS_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Step 1: Verify Initial Collapsed State
    console.log('[QA] Desktop: Checking initial collapsed state...');
    const initialState = await page.evaluate(() => {
      const collapse = document.getElementById('rhDaFilterCollapse');
      const btn = document.getElementById('rhDaFilterToggleBtn');
      const text = document.getElementById('rhDaToggleText')?.textContent.trim();
      const icon = document.getElementById('rhDaToggleIcon');
      const searchInput = document.getElementById('searchInput');

      return {
        hasCollapseElement: !!collapse,
        isCollapsed: !collapse?.classList.contains('show'),
        isDisplayNone: collapse ? window.getComputedStyle(collapse).display === 'none' : false,
        btnText: text,
        hasDownChevron: icon?.classList.contains('bi-chevron-down'),
        hasUpChevron: icon?.classList.contains('bi-chevron-up'),
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        isSearchVisible: searchInput ? searchInput.offsetParent !== null : false
      };
    });

    console.log('[QA] Desktop Initial State:', JSON.stringify(initialState, null, 2));

    if (!initialState.isCollapsed || initialState.isSearchVisible) {
      throw new Error('FAIL: Filter form is not collapsed on initial load!');
    }
    if (initialState.btnText !== 'Show Filters' || !initialState.hasDownChevron) {
      throw new Error(`FAIL: Button should say "Show Filters" with downward chevron, got: "${initialState.btnText}"`);
    }

    // Capture Desktop Collapsed Screenshot
    const desktopCollapsedPath = path.join(ARTIFACT_DIR, 'artists-filter-collapsed-desktop-1440px.png');
    await page.screenshot({ path: desktopCollapsedPath });
    console.log('[QA] Saved desktop collapsed screenshot to:', desktopCollapsedPath);

    // Step 2: Click Show Filters to Expand
    console.log('[QA] Desktop: Clicking "Show Filters" button...');
    await page.click('#rhDaFilterToggleBtn');
    await new Promise(r => setTimeout(r, 600)); // wait for collapse animation

    const expandedState = await page.evaluate(() => {
      const collapse = document.getElementById('rhDaFilterCollapse');
      const btn = document.getElementById('rhDaFilterToggleBtn');
      const text = document.getElementById('rhDaToggleText')?.textContent.trim();
      const icon = document.getElementById('rhDaToggleIcon');
      const searchInput = document.getElementById('searchInput');
      const genreFilter = document.getElementById('genreFilter');
      const locationFilter = document.getElementById('locationFilter');
      const verifiedFilter = document.getElementById('verifiedFilter');
      const sortFilter = document.getElementById('sortFilter');

      return {
        isExpanded: collapse?.classList.contains('show'),
        isDisplayBlock: collapse ? window.getComputedStyle(collapse).display !== 'none' : false,
        btnText: text,
        hasUpChevron: icon?.classList.contains('bi-chevron-up'),
        hasDownChevron: icon?.classList.contains('bi-chevron-down'),
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        isSearchVisible: searchInput ? searchInput.offsetParent !== null : false,
        isGenreVisible: genreFilter ? genreFilter.offsetParent !== null : false,
        isLocationVisible: locationFilter ? locationFilter.offsetParent !== null : false,
        isVerifiedVisible: verifiedFilter ? verifiedFilter.offsetParent !== null : false,
        isSortVisible: sortFilter ? sortFilter.offsetParent !== null : false
      };
    });

    console.log('[QA] Desktop Expanded State:', JSON.stringify(expandedState, null, 2));

    if (!expandedState.isExpanded || !expandedState.isSearchVisible) {
      throw new Error('FAIL: Filter form did not expand properly after clicking Show Filters!');
    }
    if (expandedState.btnText !== 'Hide Filters' || !expandedState.hasUpChevron) {
      throw new Error(`FAIL: Button should say "Hide Filters" with upward chevron, got: "${expandedState.btnText}"`);
    }

    // Capture Desktop Expanded Screenshot
    const desktopExpandedPath = path.join(ARTIFACT_DIR, 'artists-filter-expanded-desktop-1440px.png');
    await page.screenshot({ path: desktopExpandedPath });
    console.log('[QA] Saved desktop expanded screenshot to:', desktopExpandedPath);

    // Step 3: Click Hide Filters to Collapse Again
    console.log('[QA] Desktop: Clicking "Hide Filters" button to re-collapse...');
    await page.click('#rhDaFilterToggleBtn');
    await new Promise(r => setTimeout(r, 600));

    const reCollapsedState = await page.evaluate(() => {
      const collapse = document.getElementById('rhDaFilterCollapse');
      const text = document.getElementById('rhDaToggleText')?.textContent.trim();
      const icon = document.getElementById('rhDaToggleIcon');
      const searchInput = document.getElementById('searchInput');
      return {
        isCollapsed: !collapse?.classList.contains('show'),
        btnText: text,
        hasDownChevron: icon?.classList.contains('bi-chevron-down'),
        isSearchVisible: searchInput ? searchInput.offsetParent !== null : false
      };
    });

    console.log('[QA] Desktop Re-collapsed State:', JSON.stringify(reCollapsedState, null, 2));

    if (!reCollapsedState.isCollapsed || reCollapsedState.isSearchVisible) {
      throw new Error('FAIL: Filter form did not collapse properly after clicking Hide Filters!');
    }
    if (reCollapsedState.btnText !== 'Show Filters' || !reCollapsedState.hasDownChevron) {
      throw new Error('FAIL: Button did not reset back to "Show Filters" with downward chevron!');
    }

    await page.close();

    // ── 2. Mobile Test (375x812) ──
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });

    console.log('[QA] Mobile: Loading artists page at 375px...');
    await mobilePage.goto(ARTISTS_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    const mobileInitialState = await mobilePage.evaluate(() => {
      const collapse = document.getElementById('rhDaFilterCollapse');
      const text = document.getElementById('rhDaToggleText')?.textContent.trim();
      const icon = document.getElementById('rhDaToggleIcon');
      const searchInput = document.getElementById('searchInput');
      const bodyWidth = document.body.clientWidth;
      const scrollWidth = document.documentElement.scrollWidth;

      return {
        isCollapsed: !collapse?.classList.contains('show'),
        btnText: text,
        hasDownChevron: icon?.classList.contains('bi-chevron-down'),
        isSearchVisible: searchInput ? searchInput.offsetParent !== null : false,
        noHorizontalOverflow: scrollWidth <= bodyWidth + 2
      };
    });

    console.log('[QA] Mobile Initial State:', JSON.stringify(mobileInitialState, null, 2));

    if (!mobileInitialState.isCollapsed) {
      throw new Error('FAIL Mobile: Filter form is not collapsed by default on mobile!');
    }

    const mobileCollapsedPath = path.join(ARTIFACT_DIR, 'artists-filter-collapsed-mobile-375px.png');
    await mobilePage.screenshot({ path: mobileCollapsedPath });
    console.log('[QA] Saved mobile collapsed screenshot to:', mobileCollapsedPath);

    // Expand on mobile
    console.log('[QA] Mobile: Tapping "Show Filters"...');
    await mobilePage.click('#rhDaFilterToggleBtn');
    await new Promise(r => setTimeout(r, 600));

    const mobileExpandedState = await mobilePage.evaluate(() => {
      const collapse = document.getElementById('rhDaFilterCollapse');
      const text = document.getElementById('rhDaToggleText')?.textContent.trim();
      const icon = document.getElementById('rhDaToggleIcon');
      const searchInput = document.getElementById('searchInput');
      const bodyWidth = document.body.clientWidth;
      const scrollWidth = document.documentElement.scrollWidth;

      return {
        isExpanded: collapse?.classList.contains('show'),
        btnText: text,
        hasUpChevron: icon?.classList.contains('bi-chevron-up'),
        isSearchVisible: searchInput ? searchInput.offsetParent !== null : false,
        noHorizontalOverflow: scrollWidth <= bodyWidth + 2
      };
    });

    console.log('[QA] Mobile Expanded State:', JSON.stringify(mobileExpandedState, null, 2));

    if (!mobileExpandedState.isExpanded || !mobileExpandedState.isSearchVisible) {
      throw new Error('FAIL Mobile: Filter form did not expand properly on mobile!');
    }

    const mobileExpandedPath = path.join(ARTIFACT_DIR, 'artists-filter-expanded-mobile-375px.png');
    await mobilePage.screenshot({ path: mobileExpandedPath });
    console.log('[QA] Saved mobile expanded screenshot to:', mobileExpandedPath);

    // Re-collapse on mobile
    console.log('[QA] Mobile: Tapping "Hide Filters"...');
    await mobilePage.click('#rhDaFilterToggleBtn');
    await new Promise(r => setTimeout(r, 600));

    const mobileReCollapsed = await mobilePage.evaluate(() => {
      const collapse = document.getElementById('rhDaFilterCollapse');
      return {
        isCollapsed: !collapse?.classList.contains('show')
      };
    });

    if (!mobileReCollapsed.isCollapsed) {
      throw new Error('FAIL Mobile: Filter form did not re-collapse on mobile!');
    }

    await mobilePage.close();

    console.log('[QA] ALL TESTS PASSED SUCCESSFULLY! 100% verified.');
  } finally {
    await browser.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

runArtistsFilterQA().catch(err => {
  console.error('[QA] QA Script Error:', err);
  process.exit(1);
});

