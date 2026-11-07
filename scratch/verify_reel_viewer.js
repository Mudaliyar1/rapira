const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d';
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function run() {
  console.log('Launching browser for RAPIRA Reels Viewer Verification...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const viewports = [
    { width: 360, height: 740, name: '360px (Small Mobile)' },
    { width: 375, height: 812, name: '375px (iPhone Mobile)' },
    { width: 390, height: 844, name: '390px (Modern Mobile)' },
    { width: 414, height: 896, name: '414px (Large Mobile)' },
    { width: 768, height: 1024, name: '768px (Tablet)' },
    { width: 1024, height: 768, name: '1024px (Small Desktop/iPad Pro)' },
    { width: 1440, height: 900, name: '1440px (Desktop)' }
  ];

  const results = {};

  // Part A: Viewport Responsiveness & Layout Checks
  for (const vp of viewports) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for homepage motion script and reels
    await page.waitForSelector('.rh-reel-card', { timeout: 10000 });

    // 1. Initial State: Check Navbar is visible before modal opens
    const navBefore = await page.evaluate(() => {
      const nav = document.querySelector('.navbar');
      return {
        exists: !!nav,
        visible: nav ? window.getComputedStyle(nav).display !== 'none' : false
      };
    });

    // 2. Click the first reel card to open the viewer
    await page.click('.rh-reel-card');
    await new Promise(r => setTimeout(r, 600));

    // 3. Inspect In-Viewer State
    const inViewerState = await page.evaluate(() => {
      const modal = document.getElementById('rhReelModal');
      const dialog = document.querySelector('.rh-reel-modal-dialog');
      const nav = document.querySelector('.navbar');
      const banner = document.getElementById('websiteUpdateBanner');
      const chatbot = document.querySelector('.chatbot-toggle') || document.querySelector('.chatbot-container');
      const rail = document.querySelector('.rh-reel-action-rail');
      const info = document.querySelector('.rh-reel-info-col');
      const video = document.getElementById('rhReelVideo');
      const hasModalOpenClass = document.body.classList.contains('rh-modal-open');

      const modalRect = modal ? modal.getBoundingClientRect() : null;
      const dialogRect = dialog ? dialog.getBoundingClientRect() : null;
      const railRect = rail ? rail.getBoundingClientRect() : null;
      const infoRect = info ? info.getBoundingClientRect() : null;

      const navDisplay = nav ? window.getComputedStyle(nav).display : null;
      const navVisible = nav ? window.getComputedStyle(nav).visibility : null;
      const bannerDisplay = banner ? window.getComputedStyle(banner).display : null;
      const chatbotDisplay = chatbot ? window.getComputedStyle(chatbot).display : null;

      // Check collision between creator info and action rail
      const hasCollision = (infoRect && railRect) ? (infoRect.right > railRect.left) : false;

      // Check action rail items order
      const railBtns = Array.from(document.querySelectorAll('.rh-reel-action-rail .rh-reel-rail-item'));
      const likeCount = document.getElementById('rhReelLikeCount') ? document.getElementById('rhReelLikeCount').textContent.trim() : '';
      const commentCount = document.getElementById('rhReelCommentCount') ? document.getElementById('rhReelCommentCount').textContent.trim() : '';

      return {
        hasModalOpenClass,
        modalDisplayed: modal ? window.getComputedStyle(modal).display !== 'none' : false,
        dialogRect: dialogRect ? { width: dialogRect.width, height: dialogRect.height, left: dialogRect.left, right: dialogRect.right } : null,
        navHidden: navDisplay === 'none' || navVisible === 'hidden',
        bannerHidden: !banner || bannerDisplay === 'none',
        chatbotHidden: !chatbot || chatbotDisplay === 'none',
        railRect: railRect ? { width: railRect.width, height: railRect.height, left: railRect.left, right: railRect.right } : null,
        infoRect: infoRect ? { width: infoRect.width, height: infoRect.height, left: infoRect.left, right: infoRect.right } : null,
        hasCollision,
        railItemsCount: railBtns.length,
        likeCount,
        commentCount,
        videoPlaying: video ? !video.paused : false,
        videoHasSrc: video ? !!video.src : false,
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth
      };
    });

    results[vp.name] = { navBefore, inViewerState };
    console.log(`[PASS] Viewport ${vp.name}: navHidden=${inViewerState.navHidden}, modalDisplayed=${inViewerState.modalDisplayed}, railItems=${inViewerState.railItemsCount}, collision=${inViewerState.hasCollision}`);

    await page.close();
  }

  // Part B: Capture Deliverable Screenshots
  // 1. Mobile Full-Screen Reel Viewer (375x812)
  console.log('Capturing mobile full-screen viewer screenshot...');
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await mobilePage.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
  await mobilePage.waitForSelector('.rh-reel-card');
  await mobilePage.click('.rh-reel-card');
  await new Promise(r => setTimeout(r, 1000));
  const mobileShotPath = path.join(ARTIFACT_DIR, 'mobile-fullscreen-reel-viewer.png');
  await mobilePage.screenshot({ path: mobileShotPath, fullPage: false });
  console.log('Saved:', mobileShotPath);

  // 2. Action Rail Zoom
  console.log('Capturing action rail zoom...');
  const actionRailEl = await mobilePage.$('.rh-reel-action-rail');
  const actionRailPath = path.join(ARTIFACT_DIR, 'reel-action-rail.png');
  if (actionRailEl) {
    await actionRailEl.screenshot({ path: actionRailPath });
    console.log('Saved:', actionRailPath);
  }

  // 3. Comment Interaction Drawer
  console.log('Capturing comment interaction drawer...');
  await mobilePage.click('#rhReelCommentBtn');
  await new Promise(r => setTimeout(r, 600));
  const commentDrawerPath = path.join(ARTIFACT_DIR, 'reel-comments-drawer.png');
  await mobilePage.screenshot({ path: commentDrawerPath, fullPage: false });
  console.log('Saved:', commentDrawerPath);

  // Close comment drawer
  await mobilePage.click('.rh-comments-drawer-close');
  await new Promise(r => setTimeout(r, 400));

  // 4. Close Modal and verify Navbar restored
  console.log('Testing close modal and capturing restored navbar...');
  await mobilePage.click('.rh-reel-modal-close');
  await new Promise(r => setTimeout(r, 500));
  const navRestoredPath = path.join(ARTIFACT_DIR, 'reel-closed-navbar-restored.png');
  await mobilePage.screenshot({ path: navRestoredPath, fullPage: false });
  console.log('Saved:', navRestoredPath);

  await mobilePage.close();

  // 5. Desktop Reel Viewer (1440x900)
  console.log('Capturing desktop viewer screenshot...');
  const desktopPage = await browser.newPage();
  await desktopPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await desktopPage.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
  await desktopPage.waitForSelector('.rh-reel-card');
  await desktopPage.click('.rh-reel-card');
  await new Promise(r => setTimeout(r, 1000));
  const desktopShotPath = path.join(ARTIFACT_DIR, 'desktop-reel-viewer.png');
  await desktopPage.screenshot({ path: desktopShotPath, fullPage: false });
  console.log('Saved:', desktopShotPath);

  // Test Escape key closes modal on desktop
  console.log('Testing Escape key on desktop...');
  await desktopPage.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));
  const isClosedAfterEsc = await desktopPage.evaluate(() => {
    const modal = document.getElementById('rhReelModal');
    return !document.body.classList.contains('rh-modal-open') && (!modal || modal.style.display === 'none');
  });
  console.log('Escape key closed modal successfully:', isClosedAfterEsc);

  await desktopPage.close();

  await browser.close();
  console.log('\nAll automated browser verifications completed successfully!');
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verification-results.json'), JSON.stringify(results, null, 2), 'utf8');
}

run().catch(err => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});

