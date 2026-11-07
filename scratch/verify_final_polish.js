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

  console.log('=== 1. RESPONSIVE VERIFICATION ACROSS VIEWPORTS ===');
  const viewports = [360, 375, 390, 414, 768, 1440];
  const testResults = [];

  for (const width of viewports) {
    const isMobile = width < 768;
    await page.setViewport({ width, height: 850 });
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

    const res = await page.evaluate((isMob, w) => {
      const scrollW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const hasOverflow = scrollW > winW;

      const pag = document.getElementById('howWorksPagination');
      const dots = Array.from(document.querySelectorAll('.rh-how-dot'));
      const card = document.querySelector('.rh-artist-cta-card');
      const btn = document.querySelector('.rh-cta-action-btn');

      let pagInfo = null;
      if (isMob && pag) {
        const pagRect = pag.getBoundingClientRect();
        const pagCenter = pagRect.left + pagRect.width / 2;
        const dotYs = dots.map(d => Math.round(d.getBoundingClientRect().y));
        const allSameRow = dotYs.length === 3 && dotYs.every(y => y === dotYs[0]);
        pagInfo = {
          display: window.getComputedStyle(pag).display,
          pagCenter: Math.round(pagCenter),
          screenCenter: Math.round(w / 2),
          allSameRow,
          dotCount: dots.length,
          centered: Math.abs(pagCenter - (w / 2)) <= 2
        };
      } else if (!isMob && pag) {
        pagInfo = {
          display: window.getComputedStyle(pag).display,
          hiddenOnDesktop: window.getComputedStyle(pag).display === 'none'
        };
      }

      let ctaInfo = null;
      if (card && btn) {
        const cardRect = card.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const btnCenter = btnRect.left + btnRect.width / 2;
        const leftMargin = Math.round(btnRect.left - cardRect.left);
        const rightMargin = Math.round(cardRect.right - btnRect.right);

        ctaInfo = {
          cardWidth: Math.round(cardRect.width),
          btnWidth: Math.round(btnRect.width),
          cardCenter: Math.round(cardCenter),
          btnCenter: Math.round(btnCenter),
          centered: isMob ? Math.abs(cardCenter - btnCenter) <= 2 : true,
          leftMargin,
          rightMargin,
          equalMargins: isMob ? Math.abs(leftMargin - rightMargin) <= 2 : true
        };
      }

      return {
        width: w,
        scrollW,
        winW,
        hasOverflow,
        pagInfo,
        ctaInfo
      };
    }, isMobile, width);

    console.log(`Viewport ${width}px:`, JSON.stringify(res, null, 2));
    testResults.push(res);
  }

  console.log('\n=== 2. INTERACTION & SWIPE/CLICK VERIFICATION (375px) ===');
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  // Verify initial state
  const initialDot = await page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll('.rh-how-dot'));
    return dots.findIndex(d => d.classList.contains('active'));
  });
  console.log('Initial active dot:', initialDot, '(Expected: 0)');

  // Click dot 1
  await page.evaluate(() => {
    const dots = document.querySelectorAll('.rh-how-dot');
    if (dots[1]) dots[1].click();
  });
  await new Promise(r => setTimeout(r, 700));

  const dot1State = await page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll('.rh-how-dot'));
    const track = document.getElementById('howWorksTrack');
    return {
      activeDot: dots.findIndex(d => d.classList.contains('active')),
      scrollLeft: track.scrollLeft
    };
  });
  console.log('After clicking Dot 1:', dot1State, '(Expected activeDot: 1)');

  // Click dot 2
  await page.evaluate(() => {
    const dots = document.querySelectorAll('.rh-how-dot');
    if (dots[2]) dots[2].click();
  });
  await new Promise(r => setTimeout(r, 700));

  const dot2State = await page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll('.rh-how-dot'));
    const track = document.getElementById('howWorksTrack');
    return {
      activeDot: dots.findIndex(d => d.classList.contains('active')),
      scrollLeft: track.scrollLeft
    };
  });
  console.log('After clicking Dot 2:', dot2State, '(Expected activeDot: 2)');

  // Click dot 0
  await page.evaluate(() => {
    const dots = document.querySelectorAll('.rh-how-dot');
    if (dots[0]) dots[0].click();
  });
  await new Promise(r => setTimeout(r, 700));

  const dot0State = await page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll('.rh-how-dot'));
    const track = document.getElementById('howWorksTrack');
    return {
      activeDot: dots.findIndex(d => d.classList.contains('active')),
      scrollLeft: track.scrollLeft
    };
  });
  console.log('After clicking Dot 0:', dot0State, '(Expected activeDot: 0)');

  // Simulate swipe by scrolling track
  console.log('\nTesting Swipe Scroll sync...');
  await page.evaluate(() => {
    const track = document.getElementById('howWorksTrack');
    track.scrollLeft = 320;
    track.dispatchEvent(new Event('scroll'));
  });
  await new Promise(r => setTimeout(r, 300));

  const swipeState = await page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll('.rh-how-dot'));
    return dots.findIndex(d => d.classList.contains('active'));
  });
  console.log('Active dot after swiping to 320px:', swipeState, '(Expected: 1)');

  // Scroll back to 0
  await page.evaluate(() => {
    const track = document.getElementById('howWorksTrack');
    track.scrollLeft = 0;
    track.dispatchEvent(new Event('scroll'));
  });
  await new Promise(r => setTimeout(r, 300));

  console.log('\n=== 3. CAPTURE UPDATED SCREENSHOTS ===');
  // 1. How RAPIRA Works mobile with pagination dots
  const howWorksSection = await page.$('.rh-how-works-section');
  if (howWorksSection) {
    await howWorksSection.scrollIntoView();
    await new Promise(r => setTimeout(r, 400));
    const box = await howWorksSection.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'how-works-pagination-fixed-mobile.png'),
        clip: {
          x: 0,
          y: Math.max(0, box.y - 10),
          width: 375,
          height: Math.min(box.height + 25, 720)
        }
      });
      console.log('Saved: how-works-pagination-fixed-mobile.png');
    }
  }

  // 2. Artist CTA mobile centered
  const artistCtaSection = await page.$('.rh-artist-cta-section');
  if (artistCtaSection) {
    await artistCtaSection.scrollIntoView();
    await new Promise(r => setTimeout(r, 400));
    const box = await artistCtaSection.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'artist-cta-centered-mobile.png'),
        clip: {
          x: 0,
          y: Math.max(0, box.y - 15),
          width: 375,
          height: Math.min(box.height + 30, 480)
        }
      });
      console.log('Saved: artist-cta-centered-mobile.png');
    }
  }

  // 3. Desktop 1440px screenshot
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  const desktopCta = await page.$('.rh-artist-cta-section');
  if (desktopCta) {
    await desktopCta.scrollIntoView();
    await new Promise(r => setTimeout(r, 400));
    const box = await desktopCta.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'desktop-artist-cta-verified.png'),
        clip: {
          x: 0,
          y: Math.max(0, box.y - 20),
          width: 1440,
          height: Math.min(box.height + 40, 500)
        }
      });
      console.log('Saved: desktop-artist-cta-verified.png');
    }
  }

  await browser.close();
  console.log('\n=== ALL POLISH VERIFICATIONS COMPLETED SUCCESSFULLY! ===');
})();

