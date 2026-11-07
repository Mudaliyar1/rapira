const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d';

const VIEWPORTS = [
  { name: 'mobile-360px', width: 360, height: 800 },
  { name: 'mobile-375px', width: 375, height: 812 },
  { name: 'mobile-390px', width: 390, height: 844 },
  { name: 'mobile-414px', width: 414, height: 896 },
  { name: 'tablet-768px', width: 768, height: 1024 },
  { name: 'desktop-1024px', width: 1024, height: 768 },
  { name: 'desktop-1440px', width: 1440, height: 900 }
];

async function runQA() {
  const tempProfile = path.join(os.tmpdir(), 'puppeteer_merch_qa_' + Date.now());
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tempProfile,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  console.log('--- STARTING MERCHANDISE REDESIGN QA ---');
  let allPassed = true;

  try {
    const page = await browser.newPage();

    // Collect console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.toString()));

    // 1. Test Desktop 1440px Populated State
    console.log('\n[1] Testing Desktop 1440px Populated State...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000/shop', { waitUntil: 'networkidle2' });

    // Check Filter Bar is COLLAPSED by default
    const isCollapsedByDefault = await page.evaluate(() => {
      const collapseEl = document.getElementById('filterCollapse');
      const toggleText = document.getElementById('filterToggleText').textContent.trim();
      const hasShow = collapseEl.classList.contains('show');
      const rect = collapseEl.getBoundingClientRect();
      return !hasShow && toggleText === 'Show Filters' && rect.height === 0;
    });
    console.log('✓ Filter collapsed by default on load:', isCollapsedByDefault);
    if (!isCollapsedByDefault) allPassed = false;

    // Check Grid Columns on Desktop (should be 4 columns)
    const desktopColumns = await page.evaluate(() => {
      const grid = document.querySelector('.rh-merch-grid');
      if (!grid) return 0;
      const computed = window.getComputedStyle(grid);
      const cols = computed.gridTemplateColumns.split(' ').length;
      return cols;
    });
    console.log(`✓ Desktop grid columns: ${desktopColumns} (expected 4)`);
    if (desktopColumns !== 4) allPassed = false;

    // Capture Desktop Populated Screenshot
    const deskPopPath = path.join(ARTIFACTS_DIR, 'merchandise-desktop-1440px-populated.png');
    await page.screenshot({ path: deskPopPath, fullPage: true });
    console.log('✓ Saved desktop screenshot to:', deskPopPath);

    // Test expanding and collapsing filters
    console.log('\n[2] Testing Filter Expand / Collapse interaction...');
    await page.click('#filterToggleBtn');
    await page.waitForTimeout ? page.waitForTimeout(600) : new Promise(r => setTimeout(r, 600));

    const isExpanded = await page.evaluate(() => {
      const collapseEl = document.getElementById('filterCollapse');
      const toggleText = document.getElementById('filterToggleText').textContent.trim();
      return collapseEl.classList.contains('show') && toggleText === 'Hide Filters';
    });
    console.log('✓ Filter expanded after click:', isExpanded);
    if (!isExpanded) allPassed = false;

    // Click again to collapse
    await page.click('#filterToggleBtn');
    await page.waitForTimeout ? page.waitForTimeout(600) : new Promise(r => setTimeout(r, 600));

    const isCollapsedAgain = await page.evaluate(() => {
      const collapseEl = document.getElementById('filterCollapse');
      const toggleText = document.getElementById('filterToggleText').textContent.trim();
      return !collapseEl.classList.contains('show') && toggleText === 'Show Filters';
    });
    console.log('✓ Filter collapsed again after 2nd click:', isCollapsedAgain);
    if (!isCollapsedAgain) allPassed = false;

    // 2. Test Desktop Empty State
    console.log('\n[3] Testing Desktop Empty State...');
    await page.goto('http://localhost:3000/shop?search=NoSuchMerchXYZ123', { waitUntil: 'networkidle2' });
    const hasEmptyState = await page.evaluate(() => {
      const emptyCard = document.querySelector('.rh-merch-empty-card');
      const title = emptyCard ? emptyCard.querySelector('.rh-merch-empty-title').textContent : '';
      return !!emptyCard && title.includes('No Products Found');
    });
    console.log('✓ Desktop empty state rendered:', hasEmptyState);
    if (!hasEmptyState) allPassed = false;

    const deskEmptyPath = path.join(ARTIFACTS_DIR, 'merchandise-desktop-1440px-empty.png');
    await page.screenshot({ path: deskEmptyPath, fullPage: true });
    console.log('✓ Saved desktop empty screenshot to:', deskEmptyPath);

    // 3. Test Mobile Populated (375px)
    console.log('\n[4] Testing Mobile 375px Populated State...');
    await page.setViewport({ width: 375, height: 812 });
    await page.goto('http://localhost:3000/shop', { waitUntil: 'networkidle2' });

    // Check Grid Columns on Mobile (MUST BE 2 COLUMNS)
    const mobileColumns = await page.evaluate(() => {
      const grid = document.querySelector('.rh-merch-grid');
      if (!grid) return 0;
      const computed = window.getComputedStyle(grid);
      const cols = computed.gridTemplateColumns.split(' ').length;
      return cols;
    });
    console.log(`✓ Mobile grid columns: ${mobileColumns} (expected 2)`);
    if (mobileColumns !== 2) allPassed = false;

    const mobPopPath = path.join(ARTIFACTS_DIR, 'merchandise-mobile-375px-populated.png');
    await page.screenshot({ path: mobPopPath, fullPage: true });
    console.log('✓ Saved mobile populated screenshot to:', mobPopPath);

    // Test Mobile Filter Expand
    await page.click('#filterToggleBtn');
    await (new Promise(r => setTimeout(r, 600)));
    const mobFilterPath = path.join(ARTIFACTS_DIR, 'merchandise-mobile-filter-expanded-375px.png');
    await page.screenshot({ path: mobFilterPath, fullPage: false });
    console.log('✓ Saved mobile filter expanded screenshot to:', mobFilterPath);

    // 4. Test Mobile Empty State (375px)
    console.log('\n[5] Testing Mobile 375px Empty State...');
    await page.goto('http://localhost:3000/shop?search=NoSuchMerchXYZ123', { waitUntil: 'networkidle2' });
    const mobEmptyPath = path.join(ARTIFACTS_DIR, 'merchandise-mobile-375px-empty.png');
    await page.screenshot({ path: mobEmptyPath, fullPage: true });
    console.log('✓ Saved mobile empty screenshot to:', mobEmptyPath);

    // 5. Test Tablet Populated (768px)
    console.log('\n[6] Testing Tablet 768px Populated State...');
    await page.setViewport({ width: 768, height: 1024 });
    await page.goto('http://localhost:3000/shop', { waitUntil: 'networkidle2' });
    const tabPopPath = path.join(ARTIFACTS_DIR, 'merchandise-tablet-768px-populated.png');
    await page.screenshot({ path: tabPopPath, fullPage: true });
    console.log('✓ Saved tablet screenshot to:', tabPopPath);

    // 6. Test Responsive Overflow across ALL Viewports
    console.log('\n[7] Testing Horizontal Overflow across 7 viewports...');
    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto('http://localhost:3000/shop', { waitUntil: 'networkidle2' });
      const overflow = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        };
      });

      console.log(`- Viewport ${vp.name} (${vp.width}x${vp.height}): scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}, hasOverflow=${overflow.hasOverflow}`);
      if (overflow.hasOverflow) {
        console.error(`❌ Overflow detected on ${vp.name}!`);
        allPassed = false;
      }
    }

    // 7. Test Wishlist Toggle
    console.log('\n[8] Testing Wishlist Toggle functionality...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000/shop', { waitUntil: 'networkidle2' });
    const wishlistWorks = await page.evaluate(() => {
      const btn = document.querySelector('.rh-merch-wishlist-btn');
      if (!btn) return false;
      btn.click();
      const hasActiveClass = btn.classList.contains('active');
      const icon = btn.querySelector('i');
      const hasFillClass = icon.classList.contains('bi-heart-fill');
      return hasActiveClass && hasFillClass;
    });
    console.log('✓ Wishlist button toggles to active with heart-fill:', wishlistWorks);
    if (!wishlistWorks) allPassed = false;

    // Check Console Errors
    console.log('\n[9] Checking Console Errors...');
    const filteredErrors = consoleErrors.filter(e => !e.includes('favicon'));
    if (filteredErrors.length === 0) {
      console.log('✓ Zero console errors detected.');
    } else {
      console.warn('⚠️ Console errors detected:', filteredErrors);
    }

  } catch (err) {
    console.error('QA Error:', err);
    allPassed = false;
  } finally {
    await browser.close();
    try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch (e) {}
  }

  console.log('\n=======================================');
  console.log('MERCHANDISE QA FINAL RESULT:', allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED');
  console.log('=======================================');
}

runQA();

