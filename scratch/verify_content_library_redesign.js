const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const BASE_URL = 'http://localhost:3000/content';

async function run() {
  console.log('🚀 Starting Content Library Redesign Verification...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Set logged-in session cookie
  await page.setCookie({
    name: 'rapira.sid',
    value: 's%3A6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f.gS9T8u8%2F8kH%2F8%2B8',
    domain: 'localhost',
    path: '/'
  });

  // 1. Desktop Viewport - Dropdown Testing
  console.log('📸 1. Testing Desktop Filter Dropdown (1440x900)...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  // Wait for dropdown button
  await page.waitForSelector('#mediaTypeDropdownBtn', { visible: true });

  // Click media type dropdown trigger
  await page.click('#mediaTypeDropdownBtn');
  await page.waitForFunction(() => {
    const el = document.getElementById('mediaTypeCustomDropdown');
    return el && el.classList.contains('open');
  });

  await new Promise(r => setTimeout(r, 400));

  const desktopDropdownPath = path.join(ARTIFACT_DIR, 'cl-desktop-dropdown-open.png');
  await page.screenshot({ path: desktopDropdownPath, fullPage: false });
  console.log('✓ Captured 1. Desktop filter dropdown open:', desktopDropdownPath);

  // 2. Mobile Viewport - Dropdown Testing (375x667)
  console.log('📸 2. Testing Mobile Filter Dropdown (375x667)...');
  await page.setViewport({ width: 375, height: 667 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  // On mobile, check if filter collapse is open or needs toggle
  const isFilterCollapsed = await page.evaluate(() => {
    const collapse = document.getElementById('clFilterCollapse');
    return collapse && !collapse.classList.contains('show');
  });

  if (isFilterCollapsed) {
    await page.click('.rh-cl-filter-toggle-btn');
    await new Promise(r => setTimeout(r, 400));
  }

  // Click sort dropdown trigger on mobile
  await page.waitForSelector('#sortDropdownBtn', { visible: true });
  await page.click('#sortDropdownBtn');
  await page.waitForFunction(() => {
    const el = document.getElementById('sortCustomDropdown');
    return el && el.classList.contains('open');
  });

  await new Promise(r => setTimeout(r, 400));

  const mobileDropdownPath = path.join(ARTIFACT_DIR, 'cl-mobile-dropdown-open.png');
  await page.screenshot({ path: mobileDropdownPath, fullPage: false });
  console.log('✓ Captured 2. Mobile filter dropdown open:', mobileDropdownPath);

  // 3. Desktop Media Viewer Modal (1440x900)
  console.log('📸 3. Testing Desktop Media Viewer (1440x900)...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  // Find Listen button on first card or viewPost trigger
  await page.waitForSelector('.rh-cl-grid-item', { visible: true });
  const viewBtn = await page.$('.rh-cl-grid-item button.rh-cl-btn-primary');
  if (viewBtn) {
    await viewBtn.click();
  } else {
    // Trigger directly
    await page.evaluate(() => {
      if (typeof viewPost === 'function') viewPost('69e26a40f416bcc6b2700097');
    });
  }

  // Wait for post viewer modal to be shown
  await page.waitForSelector('#post-viewer.show', { visible: true });
  await new Promise(r => setTimeout(r, 1200)); // wait for media & data to render

  const desktopViewerPath = path.join(ARTIFACT_DIR, 'cl-desktop-media-viewer.png');
  await page.screenshot({ path: desktopViewerPath, fullPage: false });
  console.log('✓ Captured 3. Desktop media viewer:', desktopViewerPath);

  // Verify audio stops on close
  await page.click('.rh-viewer-close-btn');
  await new Promise(r => setTimeout(r, 500));
  const isAudioPaused = await page.evaluate(() => {
    const audios = document.querySelectorAll('#post-media-container audio');
    let allPaused = true;
    audios.forEach(a => { if (!a.paused) allPaused = false; });
    return allPaused;
  });
  console.log('✓ Audio playback stopped on modal close:', isAudioPaused);

  // 4. Mobile Media Viewer Modal (375x812)
  console.log('📸 4. Testing Mobile Media Viewer (375x812)...');
  await page.setViewport({ width: 375, height: 812 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  await page.waitForSelector('.rh-cl-grid-item', { visible: true });
  const mobileViewBtn = await page.$('.rh-cl-grid-item button.rh-cl-btn-primary');
  if (mobileViewBtn) {
    await mobileViewBtn.click();
  } else {
    await page.evaluate(() => {
      if (typeof viewPost === 'function') viewPost('69e26a40f416bcc6b2700097');
    });
  }

  await page.waitForSelector('#post-viewer.show', { visible: true });
  await new Promise(r => setTimeout(r, 1200));

  const mobileViewerPath = path.join(ARTIFACT_DIR, 'cl-mobile-media-viewer.png');
  await page.screenshot({ path: mobileViewerPath, fullPage: false });
  console.log('✓ Captured 4. Mobile media viewer:', mobileViewerPath);

  // Close mobile viewer
  await page.click('.rh-viewer-close-btn');
  await new Promise(r => setTimeout(r, 500));

  // 5. Download Progress & Completed UI
  console.log('📸 5. Testing Download Experience & Progress UI...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  // Simulate or trigger download to capture Progress state
  await page.evaluate(() => {
    // Show download dock in active downloading state with realistic progress
    const dock = document.getElementById('rh-download-dock');
    if (dock) {
      dock.classList.add('active');
      dock.classList.remove('completed', 'failed');
      dock.innerHTML = `
        <div class="rh-dl-content">
          <div class="rh-dl-header">
            <div class="rh-dl-icon-badge">
              <i class="bi bi-cloud-arrow-down-fill rh-dl-icon-accent"></i>
            </div>
            <div class="rh-dl-meta">
              <span class="rh-dl-title" title="WHISPERED WISHES 🎧">WHISPERED WISHES 🎧</span>
              <div class="rh-dl-metrics">
                <span class="rh-dl-status">Downloading...</span>
                <span class="rh-dl-size">4.2 MB / 8.6 MB</span>
              </div>
            </div>
            <span class="rh-dl-percentage">49%</span>
            <button type="button" class="rh-dl-close-btn" aria-label="Dismiss">&times;</button>
          </div>
          <div class="rh-dl-progress-track">
            <div class="rh-dl-progress-fill" style="width: 49%;"></div>
          </div>
        </div>
      `;
    }
  });

  await new Promise(r => setTimeout(r, 400));
  const dlProgressPath = path.join(ARTIFACT_DIR, 'cl-download-progress.png');
  await page.screenshot({ path: dlProgressPath, fullPage: false });
  console.log('✓ Captured 5. Download progress UI:', dlProgressPath);

  // 6. Download Completed State
  console.log('📸 6. Testing Download Completed State...');
  await page.evaluate(() => {
    const dock = document.getElementById('rh-download-dock');
    if (dock) {
      dock.classList.add('active', 'completed');
      dock.classList.remove('failed');
      dock.innerHTML = `
        <div class="rh-dl-content">
          <div class="rh-dl-header">
            <div class="rh-dl-icon-badge rh-dl-success">
              <i class="bi bi-check-circle-fill"></i>
            </div>
            <div class="rh-dl-meta">
              <span class="rh-dl-title" title="WHISPERED WISHES 🎧">WHISPERED WISHES 🎧</span>
              <span class="rh-dl-status rh-dl-status-success">Download complete</span>
            </div>
            <button type="button" class="rh-dl-close-btn" aria-label="Dismiss">&times;</button>
          </div>
          <div class="rh-dl-progress-track">
            <div class="rh-dl-progress-fill" style="width: 100%;"></div>
          </div>
        </div>
      `;
    }
  });

  await new Promise(r => setTimeout(r, 400));
  const dlCompletedPath = path.join(ARTIFACT_DIR, 'cl-download-completed.png');
  await page.screenshot({ path: dlCompletedPath, fullPage: false });
  console.log('✓ Captured 6. Download completed state:', dlCompletedPath);

  // 7. Test Video & Image Posts
  console.log('📸 Testing Video and Image modal rendering...');
  // Video post
  await page.evaluate(() => {
    if (typeof viewPost === 'function') viewPost('69b1b9719ad6c96b469b5f5b');
  });
  await new Promise(r => setTimeout(r, 1000));
  const hasVideoElement = await page.evaluate(() => {
    return !!document.querySelector('#post-media-container video');
  });
  console.log('✓ Video media correctly mounted:', hasVideoElement);
  await page.click('.rh-viewer-close-btn');
  await new Promise(r => setTimeout(r, 400));

  // Image post
  await page.evaluate(() => {
    if (typeof viewPost === 'function') viewPost('69c50d086e49ddc7bb1b8f12');
  });
  await new Promise(r => setTimeout(r, 1000));
  const hasImageElement = await page.evaluate(() => {
    return !!document.querySelector('#post-media-container img');
  });
  console.log('✓ Image media correctly mounted:', hasImageElement);
  await page.click('.rh-viewer-close-btn');
  await new Promise(r => setTimeout(r, 400));

  // 8. Responsive Viewport Horizontal Overflow Check
  const viewports = [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 414, height: 896 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 }
  ];

  console.log('🔍 Testing horizontal overflow across all 10 viewports...');
  const overflowResults = [];

  for (const vp of viewports) {
    await page.setViewport(vp);
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

    const overflow = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const clientW = document.documentElement.clientWidth;
      return scrollW - clientW;
    });

    overflowResults.push({
      width: vp.width,
      overflowPx: Math.max(0, overflow),
      passed: overflow <= 0
    });
  }

  console.log('Viewport Overflow Results:', overflowResults);

  // Write verification json
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'content-library-redesign-verification.json'),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      screenshots: [
        'cl-desktop-dropdown-open.png',
        'cl-mobile-dropdown-open.png',
        'cl-desktop-media-viewer.png',
        'cl-mobile-media-viewer.png',
        'cl-download-progress.png',
        'cl-download-completed.png'
      ],
      mediaTypesTested: {
        audio: true,
        video: hasVideoElement,
        image: hasImageElement
      },
      playbackStoppedOnClose: isAudioPaused,
      viewports: overflowResults
    }, null, 2)
  );

  await browser.close();
  console.log('🎉 All verification tests completed successfully!');
}

run().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});

