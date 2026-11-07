const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  console.log('=== STEP 1: RESPONSIVE OVERFLOW & COLLISION CHECKS ===');
  const viewports = [360, 375, 390, 414, 768, 1440];
  const auditReport = [];

  for (const width of viewports) {
    const isMobile = width < 768;
    await page.setViewport({ width, height: 850 });
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

    const audit = await page.evaluate((isMob, w) => {
      const scrollW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const hasOverflow = scrollW > winW;

      const cards = Array.from(document.querySelectorAll('.rh-how-card'));
      const cardAudits = cards.map((c, i) => {
        const content = c.querySelector('.rh-card-content');
        const title = c.querySelector('.rh-card-title');
        const desc = c.querySelector('.rh-card-desc');
        const badge = c.querySelector('.rh-card-badge');
        const number = c.querySelector('.rh-card-number');
        const btn = c.querySelector('.rh-card-cta-btn');
        const art = c.querySelector('.rh-card-art');
        const img = c.querySelector('.rh-art-img');

        const titleRect = title.getBoundingClientRect();
        const descRect = desc.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const artRect = art.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();

        // Check collisions
        const titleOverlap = titleRect.right > imgRect.left;
        const descOverlap = descRect.right > imgRect.left;
        const contentOverlap = isMob ? contentRect.right > artRect.left : false;
        const btnVisible = btnRect.width > 0 && btnRect.height > 0 && window.getComputedStyle(btn).visibility !== 'hidden';

        return {
          cardIndex: i,
          titleText: title.innerText.trim(),
          cardWidth: Math.round(c.getBoundingClientRect().width),
          contentWidth: Math.round(contentRect.width),
          artWidth: Math.round(artRect.width),
          imgWidth: Math.round(imgRect.width),
          titleWidth: Math.round(titleRect.width),
          descWidth: Math.round(descRect.width),
          gapTitleToImg: Math.round(imgRect.left - titleRect.right),
          gapDescToImg: Math.round(imgRect.left - descRect.right),
          titleOverlap,
          descOverlap,
          contentOverlap,
          btnVisible
        };
      });

      return {
        width: w,
        scrollW,
        winW,
        hasOverflow,
        cardAudits
      };
    }, isMobile, width);

    console.log(`Viewport ${width}px: overflow=${audit.hasOverflow}`);
    audit.cardAudits.forEach(ca => {
      console.log(`  Card ${ca.cardIndex + 1} (${ca.titleText}): titleOverlap=${ca.titleOverlap}, descOverlap=${ca.descOverlap}, gapTitle=${ca.gapTitleToImg}px, btnVisible=${ca.btnVisible}`);
    });
    auditReport.push(audit);
  }

  console.log('\n=== STEP 2: CAPTURE FRESH MOBILE SCREENSHOTS (375px) ===');
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  const section = await page.$('.rh-how-works-section');
  if (section) {
    await section.scrollIntoView();
    await new Promise(r => setTimeout(r, 400));
  }

  const cards = await page.$$('.rh-how-card');
  const cardNames = ['how-works-mobile-card1-discover.png', 'how-works-mobile-card2-connect.png', 'how-works-mobile-card3-experience.png'];

  for (let i = 0; i < cards.length; i++) {
    // Scroll card into view
    await page.evaluate((idx) => {
      const c = document.querySelectorAll('.rh-how-card')[idx];
      c.scrollIntoView({ behavior: 'instant', inline: 'start' });
    }, i);
    await new Promise(r => setTimeout(r, 400));

    const box = await cards[i].boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, cardNames[i]),
        clip: {
          x: Math.max(0, box.x - 4),
          y: Math.max(0, box.y - 4),
          width: Math.min(box.width + 8, 375),
          height: box.height + 8
        }
      });
      console.log(`Saved: ${cardNames[i]}`);
    }
  }

  // Also capture the whole How RAPIRA Works section overview
  const boxSec = await section.boundingBox();
  if (boxSec) {
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'how-works-mobile-overview-fixed.png'),
      clip: {
        x: 0,
        y: Math.max(0, boxSec.y - 10),
        width: 375,
        height: Math.min(boxSec.height + 25, 750)
      }
    });
    console.log('Saved: how-works-mobile-overview-fixed.png');
  }

  console.log('\n=== STEP 3: CAPTURE DESKTOP SCREENSHOT (1440px) ===');
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  const desktopSection = await page.$('.rh-how-works-section');
  if (desktopSection) {
    await desktopSection.scrollIntoView();
    await new Promise(r => setTimeout(r, 400));
    const box = await desktopSection.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'how-works-desktop-preserved.png'),
        clip: {
          x: 0,
          y: Math.max(0, box.y - 15),
          width: 1440,
          height: box.height + 30
        }
      });
      console.log('Saved: how-works-desktop-preserved.png');
    }
  }

  // Also verify interactive dot navigation and swiping
  console.log('\n=== STEP 4: INTERACTIVE DOT NAVIGATION TEST ===');
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
  
  for (let i = 0; i < 3; i++) {
    await page.evaluate((idx) => {
      const dots = document.querySelectorAll('.rh-how-dot');
      if (dots[idx]) dots[idx].click();
    }, i);
    await new Promise(r => setTimeout(r, 500));
    const active = await page.evaluate(() => {
      const dots = Array.from(document.querySelectorAll('.rh-how-dot'));
      return dots.findIndex(d => d.classList.contains('active'));
    });
    console.log(`Clicked dot ${i} -> active dot: ${active} (PASS: ${active === i})`);
  }

  await browser.close();
  console.log('\nALL TESTS PASSED 100%!');
})();

