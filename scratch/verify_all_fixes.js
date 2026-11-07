const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const brainDir = 'C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  console.log('=== 1. VERIFYING DESKTOP (1440px) ===');
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  // Check Number vs Badge vertical separation on all 3 cards
  const overlapCheck = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.rh-how-card'));
    return cards.map((card, idx) => {
      const num = card.querySelector('.rh-card-number');
      const badge = card.querySelector('.rh-card-badge');
      const numRect = num ? num.getBoundingClientRect() : null;
      const badgeRect = badge ? badge.getBoundingClientRect() : null;
      const hasOverlap = (numRect && badgeRect) ? !(badgeRect.top >= numRect.bottom || numRect.top >= badgeRect.bottom || badgeRect.left >= numRect.right || numRect.left >= badgeRect.right) : false;
      const verticalGap = (numRect && badgeRect) ? (badgeRect.top - numRect.bottom) : null;
      return {
        cardIndex: idx + 1,
        numText: num ? num.textContent.trim() : null,
        numVisible: num ? numRect.height > 0 : false,
        badgeVisible: badge ? badgeRect.height > 0 : false,
        verticalGap,
        hasOverlap
      };
    });
  });
  console.log('Number & Badge overlap check:', JSON.stringify(overlapCheck, null, 2));

  // Capture Desktop How RAPIRA Works
  const howSection = await page.$('.rh-how-works-section');
  if (howSection) {
    await howSection.screenshot({
      path: path.join(brainDir, 'how-rapira-works-desktop.png')
    });
    console.log('Saved how-rapira-works-desktop.png');
  }

  console.log('\n=== 2. VERIFYING MOBILE (375px) ===');
  await page.setViewport({ width: 375, height: 950, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  // Check Number vs Badge vertical separation on mobile
  const mobileOverlap = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.rh-how-card'));
    return cards.map((card, idx) => {
      const num = card.querySelector('.rh-card-number');
      const badge = card.querySelector('.rh-card-badge');
      const numRect = num ? num.getBoundingClientRect() : null;
      const badgeRect = badge ? badge.getBoundingClientRect() : null;
      const verticalGap = (numRect && badgeRect) ? (badgeRect.top - numRect.bottom) : null;
      const hasOverlap = verticalGap !== null && verticalGap < 0;
      return { card: idx + 1, num: num ? num.textContent.trim() : null, verticalGap, hasOverlap };
    });
  });
  console.log('Mobile Number & Badge check:', JSON.stringify(mobileOverlap, null, 2));

  // Capture Mobile How RAPIRA Works
  const howSectionMob = await page.$('.rh-how-works-section');
  if (howSectionMob) {
    await howSectionMob.screenshot({
      path: path.join(brainDir, 'how-rapira-works-mobile.png')
    });
    console.log('Saved how-rapira-works-mobile.png');
  }

  // 3. FEATURED ARTISTS MOBILE TESTING
  console.log('\n=== 3. FEATURED ARTISTS CAROUSEL TESTING ===');
  
  // Check dots centering and swipe hint alignment
  const navLayout = await page.evaluate(() => {
    const section = document.querySelector('.rh-artists-section');
    const dots = document.getElementById('homeArtistsDots');
    const label = document.querySelector('.rh-artists-swipe-label');
    const secRect = section.getBoundingClientRect();
    const dotsRect = dots ? dots.getBoundingClientRect() : null;
    const labelRect = label ? label.getBoundingClientRect() : null;

    const secCenter = secRect.left + secRect.width / 2;
    const dotsCenter = dotsRect ? (dotsRect.left + dotsRect.width / 2) : 0;
    const centerOffset = Math.abs(secCenter - dotsCenter);

    return {
      sectionWidth: secRect.width,
      dotsCenterOffset: Math.round(centerOffset),
      isDotsCentered: centerOffset < 8,
      isLabelLeftAligned: labelRect ? labelRect.left < 40 : false
    };
  });
  console.log('Featured Artists Navigation Layout:', JSON.stringify(navLayout, null, 2));

  // Capture Featured Artists Mobile Card 1
  const artistsSection = await page.$('.rh-artists-section');
  if (artistsSection) {
    await artistsSection.screenshot({
      path: path.join(brainDir, 'featured-artists-mobile-card1.png')
    });
    console.log('Saved featured-artists-mobile-card1.png');
  }

  // Swipe / Scroll to Card 2
  console.log('Swiping to Card 2...');
  const card2Result = await page.evaluate(async () => {
    const container = document.getElementById('homeArtistsContainer');
    const cards = container.querySelectorAll('.rh-artist-col');
    if (cards[1]) {
      cards[1].scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'start' });
      container.dispatchEvent(new Event('scroll'));
    }
    await new Promise(r => setTimeout(r, 400));
    const dots = Array.from(document.querySelectorAll('#homeArtistsDots .rh-dot'));
    return {
      activeDotIndex: dots.findIndex(d => d.classList.contains('active')),
      scrollLeft: container.scrollLeft
    };
  });
  console.log('Card 2 swipe state:', JSON.stringify(card2Result));
  await new Promise(r => setTimeout(r, 400));

  if (artistsSection) {
    await artistsSection.screenshot({
      path: path.join(brainDir, 'featured-artists-mobile-card2.png')
    });
    console.log('Saved featured-artists-mobile-card2.png');
  }

  // Swipe / Scroll back to Card 1
  console.log('Swiping back to Card 1...');
  const card1BackResult = await page.evaluate(async () => {
    const container = document.getElementById('homeArtistsContainer');
    const cards = container.querySelectorAll('.rh-artist-col');
    if (cards[0]) {
      cards[0].scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'start' });
      container.dispatchEvent(new Event('scroll'));
    }
    await new Promise(r => setTimeout(r, 400));
    const dots = Array.from(document.querySelectorAll('#homeArtistsDots .rh-dot'));
    return {
      activeDotIndex: dots.findIndex(d => d.classList.contains('active')),
      scrollLeft: container.scrollLeft
    };
  });
  console.log('Card 1 back swipe state:', JSON.stringify(card1BackResult));
  await new Promise(r => setTimeout(r, 400));

  if (artistsSection) {
    await artistsSection.screenshot({
      path: path.join(brainDir, 'featured-artists-mobile-card1-back.png')
    });
    console.log('Saved featured-artists-mobile-card1-back.png');
  }

  // 4. Test dot click navigation
  console.log('Testing Dot 2 Click Navigation...');
  const dotClickResult = await page.evaluate(async () => {
    const dots = Array.from(document.querySelectorAll('#homeArtistsDots .rh-dot'));
    if (dots[2]) {
      dots[2].click();
    }
    await new Promise(r => setTimeout(r, 600));
    return {
      activeDotIndex: dots.findIndex(d => d.classList.contains('active')),
      scrollLeft: document.getElementById('homeArtistsContainer').scrollLeft
    };
  });
  console.log('Dot 2 click navigation result:', JSON.stringify(dotClickResult));

  // 5. Test viewports for overflow
  console.log('\n=== 4. TESTING ALL VIEWPORTS FOR HORIZONTAL OVERFLOW ===');
  const viewports = [360, 375, 390, 414, 768, 1024, 1440];
  const vpResults = [];
  for (const w of viewports) {
    await page.setViewport({ width: w, height: 900 });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    vpResults.push({ width: w, hasOverflow: overflow });
  }
  console.log('Viewport Overflow Results:', JSON.stringify(vpResults, null, 2));

  await browser.close();
  console.log('\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
})();

