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

async function runFinalVerification() {
  const tempUserDataDir = path.join(require('os').tmpdir(), 'pptr_final_' + Date.now());
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tempUserDataDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const results = {
    url: 'http://localhost:3000/about',
    status: null,
    heroImage: null,
    missionImage: null,
    overflowResults: [],
    screenshots: []
  };

  // 1. Desktop 1440px
  await page.setViewport({ width: 1440, height: 900 });
  const response = await page.goto('http://localhost:3000/about', { waitUntil: 'networkidle2' });
  results.status = response.status();
  await new Promise(r => setTimeout(r, 600));

  // Inspect Hero image
  results.heroImage = await page.evaluate(() => {
    const img = document.querySelector('.rh-hero-media-card img.rh-hero-img');
    if (!img) return null;
    return {
      currentSrc: img.currentSrc,
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

  // Inspect Mission image
  results.missionImage = await page.evaluate(() => {
    const img = document.querySelector('.rh-mission-media-card img.rh-mission-img');
    if (!img) return null;
    return {
      currentSrc: img.currentSrc,
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

  // Screenshots: Hero section desktop
  const heroEl = await page.$('.rh-about-hero-section');
  if (heroEl) {
    const p = path.join(ARTIFACT_DIR, 'about-hero-section-desktop-final.png');
    await heroEl.screenshot({ path: p });
    results.screenshots.push({ name: 'about-hero-section-desktop-final', path: p });
  }

  // Screenshots: Mission section desktop
  const missionEl = await page.$('.rh-about-mission-section');
  if (missionEl) {
    const p = path.join(ARTIFACT_DIR, 'about-mission-section-desktop-final.png');
    await missionEl.screenshot({ path: p });
    results.screenshots.push({ name: 'about-mission-section-desktop-final', path: p });
  }

  // Full page desktop
  const fullDesk = path.join(ARTIFACT_DIR, 'about-full-desktop-final.png');
  await page.screenshot({ path: fullDesk, fullPage: true });
  results.screenshots.push({ name: 'about-full-desktop-final', path: fullDesk });

  // Tablet 768px
  await page.setViewport({ width: 768, height: 1024 });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 400));
  const fullTablet = path.join(ARTIFACT_DIR, 'about-full-tablet-768px-final.png');
  await page.screenshot({ path: fullTablet, fullPage: true });
  results.screenshots.push({ name: 'about-full-tablet-768px-final', path: fullTablet });

  // Mobile 375px
  await page.setViewport({ width: 375, height: 812 });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 400));

  const heroMob = await page.$('.rh-about-hero-section');
  if (heroMob) {
    const p = path.join(ARTIFACT_DIR, 'about-hero-mobile-375px-final.png');
    await heroMob.screenshot({ path: p });
    results.screenshots.push({ name: 'about-hero-mobile-375px-final', path: p });
  }

  const missionMob = await page.$('.rh-about-mission-section');
  if (missionMob) {
    const p = path.join(ARTIFACT_DIR, 'about-mission-mobile-375px-final.png');
    await missionMob.screenshot({ path: p });
    results.screenshots.push({ name: 'about-mission-mobile-375px-final', path: p });
  }

  const fullMobile = path.join(ARTIFACT_DIR, 'about-full-mobile-375px-final.png');
  await page.screenshot({ path: fullMobile, fullPage: true });
  results.screenshots.push({ name: 'about-full-mobile-375px-final', path: fullMobile });

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
    path.join(ARTIFACT_DIR, 'about_both_images_verification.json'),
    JSON.stringify(results, null, 2)
  );

  console.log('=== Final Verification Complete ===');
  console.log('Status:', results.status);
  console.log('Hero Image:', results.heroImage);
  console.log('Mission Image:', results.missionImage);
  console.log('Overflow results:');
  results.overflowResults.forEach(r => {
    console.log(`  ${r.viewport}: overflow = ${r.overflowPx}px (hasOverflow: ${r.hasHorizontalOverflow})`);
  });
}

runFinalVerification().catch(err => {
  console.error('Final verification error:', err);
  process.exit(1);
});

