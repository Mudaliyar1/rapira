const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // 1. Desktop 1440px
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 800));

  const howSection = await page.$('.rh-how-works-section');
  if (howSection) {
    await howSection.screenshot({
      path: path.join(ARTIFACTS_DIR, 'before-how-it-works-desktop-1440px.png')
    });
  }

  // 2. Mobile 390px - all three cards
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 800));

  // Screenshot Card 1
  const card1 = await page.$('.rh-card-discover');
  if (card1) {
    await card1.screenshot({ path: path.join(ARTIFACTS_DIR, 'before-card1-discover-mobile.png') });
  }

  // Scroll to Card 2 and screenshot
  await page.evaluate(() => {
    const track = document.querySelector('.rh-how-cards-track');
    if (track) track.scrollTo({ left: 300, behavior: 'instant' });
  });
  await new Promise(r => setTimeout(r, 400));
  const card2 = await page.$('.rh-card-connect');
  if (card2) {
    await card2.screenshot({ path: path.join(ARTIFACTS_DIR, 'before-card2-connect-mobile.png') });
  }

  // Scroll to Card 3 and screenshot
  await page.evaluate(() => {
    const track = document.querySelector('.rh-how-cards-track');
    if (track) track.scrollTo({ left: 700, behavior: 'instant' });
  });
  await new Promise(r => setTimeout(r, 400));
  const card3 = await page.$('.rh-card-experience');
  if (card3) {
    await card3.screenshot({ path: path.join(ARTIFACTS_DIR, 'before-card3-experience-mobile.png') });
  }

  // Measure Card 3 artwork on mobile
  const card3Metrics = await page.evaluate(() => {
    const card = document.querySelector('.rh-card-experience');
    const art = card ? card.querySelector('.rh-card-art') : null;
    const img = card ? card.querySelector('.rh-art-img') : null;
    const content = card ? card.querySelector('.rh-card-content') : null;

    const cardRect = card ? card.getBoundingClientRect() : null;
    const artRect = art ? art.getBoundingClientRect() : null;
    const imgRect = img ? img.getBoundingClientRect() : null;
    const contentRect = content ? content.getBoundingClientRect() : null;

    return {
      card: cardRect,
      art: artRect,
      img: imgRect,
      content: contentRect
    };
  });
  console.log('Current Mobile Card 3 Metrics:', JSON.stringify(card3Metrics, null, 2));

  await browser.close();
})();

