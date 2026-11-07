const puppeteer = require('d:/Nightcode/rapira/node_modules/puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const VIEWPORTS = [
  { name: 'mobile-small-360px', width: 360, height: 740 },
  { name: 'mobile-standard-375px', width: 375, height: 812 },
  { name: 'mobile-large-390px', width: 390, height: 844 },
  { name: 'mobile-phablet-414px', width: 414, height: 896 },
  { name: 'tablet-768px', width: 768, height: 1024 },
  { name: 'laptop-small-1024px', width: 1024, height: 768 },
  { name: 'laptop-standard-1280px', width: 1280, height: 800 },
  { name: 'desktop-standard-1440px', width: 1440, height: 900 },
  { name: 'desktop-wide-1920px', width: 1920, height: 1080 }
];

async function runVerification() {
  const tempUserDataDir = path.join(require('os').tmpdir(), 'pptr_test_' + Date.now());
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tempUserDataDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const results = {
    url: 'http://localhost:3000/about',
    status: null,
    heroImageInfo: null,
    missionPlaceholderPresent: false,
    overflowResults: [],
    screenshots: []
  };

  // 1. Initial Desktop Load (1440px)
  await page.setViewport({ width: 1440, height: 900 });
  const response = await page.goto('http://localhost:3000/about', { waitUntil: 'networkidle2' });
  results.status = response.status();
  await new Promise(r => setTimeout(r, 600));

  // Inspect Hero image
  results.heroImageInfo = await page.evaluate(() => {
    const img = document.querySelector('.rh-hero-media-card img.rh-hero-img');
    if (!img) return null;
    return {
      src: img.src,
      alt: img.alt,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      renderedWidth: img.offsetWidth,
      renderedHeight: img.offsetHeight,
      objectFit: window.getComputedStyle(img).objectFit,
      objectPosition: window.getComputedStyle(img).objectPosition
    };
  });

  // Inspect Mission placeholder
  results.missionPlaceholderPresent = await page.evaluate(() => {
    const placeholder = document.querySelector('.rh-mission-media-card .rh-media-placeholder');
    return Boolean(placeholder);
  });

  // Capture Hero Section Desktop
  const heroEl = await page.$('.rh-about-hero-section');
  if (heroEl) {
    const heroPath = path.join(ARTIFACT_DIR, 'about-hero-with-image-desktop.png');
    await heroEl.screenshot({ path: heroPath });
    results.screenshots.push({ name: 'hero-with-image-desktop', path: heroPath });
  }

  // Full page desktop
  const fullDesktopPath = path.join(ARTIFACT_DIR, 'about-full-with-image-desktop.png');
  await page.screenshot({ path: fullDesktopPath, fullPage: true });
  results.screenshots.push({ name: 'about-full-with-image-desktop', path: fullDesktopPath });

  // Mobile screenshot at 375px
  await page.setViewport({ width: 375, height: 812 });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 400));
  
  const heroMobileEl = await page.$('.rh-about-hero-section');
  if (heroMobileEl) {
    const heroMobilePath = path.join(ARTIFACT_DIR, 'about-hero-with-image-mobile-375px.png');
    await heroMobileEl.screenshot({ path: heroMobilePath });
    results.screenshots.push({ name: 'hero-with-image-mobile-375px', path: heroMobilePath });
  }

  const fullMobilePath = path.join(ARTIFACT_DIR, 'about-full-with-image-mobile-375px.png');
  await page.screenshot({ path: fullMobilePath, fullPage: true });
  results.screenshots.push({ name: 'about-full-with-image-mobile-375px', path: fullMobilePath });

  // 2. Viewport Overflow Checks
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 200));

    const overflowData = await page.evaluate(() => {
      const docEl = document.documentElement;
      const body = document.body;
      const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
      const clientWidth = docEl.clientWidth;
      const overflow = scrollWidth - clientWidth;
      return {
        winWidth: window.innerWidth,
        maxScrollWidth: scrollWidth,
        overflowPx: overflow,
        hasHorizontalOverflow: overflow > 1
      };
    });

    results.overflowResults.push({
      viewport: vp.name,
      expectedWidth: vp.width,
      ...overflowData
    });
  }

  await browser.close();

  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'about_image_fix_verification.json'),
    JSON.stringify(results, null, 2)
  );

  console.log('Verification Complete:');
  console.log('Status:', results.status);
  console.log('Hero Image:', results.heroImageInfo);
  console.log('Mission Placeholder Present:', results.missionPlaceholderPresent);
  console.log('Overflow results:');
  results.overflowResults.forEach(r => {
    console.log(`  ${r.viewport}: overflow = ${r.overflowPx}px (hasOverflow: ${r.hasHorizontalOverflow})`);
  });
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
