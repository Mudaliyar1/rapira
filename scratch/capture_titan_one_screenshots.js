const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d';
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function capture() {
  console.log('Launching browser to capture Titan One verification screenshots...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // 1. Desktop Full Viewport & Hero (1440x900)
  console.log('Capturing desktop homepage...');
  const desktopPage = await browser.newPage();
  await desktopPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await desktopPage.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
  // Disable AOS opacity transitions so static screenshots render crisply
  await desktopPage.addStyleTag({ content: '[data-aos] { opacity: 1 !important; transform: none !important; }' });
  await new Promise(r => setTimeout(r, 600));

  const desktopShot = path.join(ARTIFACT_DIR, 'titan-one-desktop-homepage.png');
  await desktopPage.screenshot({ path: desktopShot, fullPage: false });
  console.log('Saved:', desktopShot);

  // 2. Desktop Hero Zoom
  console.log('Capturing hero headline zoom...');
  const heroEl = await desktopPage.$('.rh-hero-section');
  if (heroEl) {
    const heroShot = path.join(ARTIFACT_DIR, 'titan-one-hero-detail.png');
    await heroEl.screenshot({ path: heroShot });
    console.log('Saved:', heroShot);
  }

  // 3. How RAPIRA Works Section Zoom
  console.log('Capturing How RAPIRA Works detail...');
  const howEl = await desktopPage.$('.rh-how-works-section');
  if (howEl) {
    const howShot = path.join(ARTIFACT_DIR, 'titan-one-how-rapira-works.png');
    await howEl.screenshot({ path: howShot });
    console.log('Saved:', howShot);
  }

  // 4. Section Headings Zoom (Featured Artists & Upcoming Concerts)
  console.log('Capturing section headings detail...');
  const artistsSection = await desktopPage.$('.rh-artists-section');
  if (artistsSection) {
    const sectionShot = path.join(ARTIFACT_DIR, 'titan-one-section-headings.png');
    await artistsSection.screenshot({ path: sectionShot });
    console.log('Saved:', sectionShot);
  }

  await desktopPage.close();

  // 5. Mobile Homepage (375x812)
  console.log('Capturing mobile homepage...');
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await mobilePage.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
  await mobilePage.addStyleTag({ content: '[data-aos] { opacity: 1 !important; transform: none !important; }' });
  await new Promise(r => setTimeout(r, 600));

  const mobileShot = path.join(ARTIFACT_DIR, 'titan-one-mobile-homepage.png');
  await mobilePage.screenshot({ path: mobileShot, fullPage: false });
  console.log('Saved:', mobileShot);

  await mobilePage.close();

  await browser.close();
  console.log('All Titan One verification screenshots captured successfully!');
}

capture().catch(console.error);

