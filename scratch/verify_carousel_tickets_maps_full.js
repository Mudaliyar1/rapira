const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  console.log('Starting full verification of Carousel, Ticket Booking Buttons, and Google Maps...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // 1. Verify Homepage Carousel on Desktop
  console.log('\n--- 1. Testing Homepage Carousel (Desktop 1440x900) ---');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  // Verify carousel element exists
  const carouselExists = await page.$('#mainCarousel');
  console.log('Carousel #mainCarousel present:', !!carouselExists);

  // Capture Slide 0
  const carouselEl = await page.$('.rh-hero-banner-container');
  if (carouselEl) {
    await carouselEl.screenshot({
      path: path.join(ARTIFACTS_DIR, 'desktop-carousel-slide0.png')
    });
    console.log('Captured desktop-carousel-slide0.png');
  }

  // Switch to Slide 1 (Artist Register)
  await page.evaluate(() => {
    const btn = document.querySelector('#mainCarousel [data-bs-slide-to="1"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  const slide1Info = await page.evaluate(() => {
    const item = document.querySelector('#mainCarousel .carousel-item[data-slide-index="1"]');
    const img = item ? item.querySelector('img.rh-slide-img') : null;
    const caption = item ? item.querySelector('.carousel-caption') : null;
    return {
      isActive: item ? item.classList.contains('active') : false,
      imgSrc: img ? img.src : null,
      naturalWidth: img ? img.naturalWidth : 0,
      naturalHeight: img ? img.naturalHeight : 0,
      hasCaption: !!caption
    };
  });
  console.log('Slide 1 state:', slide1Info);

  if (carouselEl) {
    await carouselEl.screenshot({
      path: path.join(ARTIFACTS_DIR, 'desktop-carousel-slide1-artist.png')
    });
    console.log('Captured desktop-carousel-slide1-artist.png');
  }

  // Switch to Slide 2 (Album US)
  await page.evaluate(() => {
    const btn = document.querySelector('#mainCarousel [data-bs-slide-to="2"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  if (carouselEl) {
    await carouselEl.screenshot({
      path: path.join(ARTIFACTS_DIR, 'desktop-carousel-slide2-album.png')
    });
    console.log('Captured desktop-carousel-slide2-album.png');
  }

  // Switch to Slide 3 (Circlebound)
  await page.evaluate(() => {
    const btn = document.querySelector('#mainCarousel [data-bs-slide-to="3"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  if (carouselEl) {
    await carouselEl.screenshot({
      path: path.join(ARTIFACTS_DIR, 'desktop-carousel-slide3-circlebound.png')
    });
    console.log('Captured desktop-carousel-slide3-circlebound.png');
  }

  // 2. Verify Homepage Carousel on Mobile (390x844)
  console.log('\n--- 2. Testing Homepage Carousel (Mobile 390x844) ---');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  const mobileCarouselEl = await page.$('.rh-hero-banner-container');
  if (mobileCarouselEl) {
    await mobileCarouselEl.screenshot({
      path: path.join(ARTIFACTS_DIR, 'mobile-carousel-slide0.png')
    });
    console.log('Captured mobile-carousel-slide0.png');
  }

  // Slide 1 on mobile
  await page.evaluate(() => {
    const btn = document.querySelector('#mainCarousel [data-bs-slide-to="1"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  if (mobileCarouselEl) {
    await mobileCarouselEl.screenshot({
      path: path.join(ARTIFACTS_DIR, 'mobile-carousel-slide1-artist.png')
    });
    console.log('Captured mobile-carousel-slide1-artist.png');
  }

  // 3. Verify Concert Details Page (Desktop 1440x900)
  console.log('\n--- 3. Testing Concert Details Page (Desktop 1440x900) ---');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/concerts/6aec50df716ae22e5aa1797f', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  // Check Ticket Booking action buttons
  const bookingCheckDesktop = await page.evaluate(() => {
    const row = document.querySelector('.rh-booking-actions-row');
    if (!row) return { found: false };
    const btns = Array.from(row.querySelectorAll('.rh-booking-btn'));
    const rowRect = row.getBoundingClientRect();
    const btnRects = btns.map(b => {
      const r = b.getBoundingClientRect();
      const style = window.getComputedStyle(b);
      return {
        text: b.textContent.trim(),
        href: b.getAttribute('href'),
        width: r.width,
        height: r.height,
        top: r.top,
        whiteSpace: style.whiteSpace,
        display: style.display
      };
    });
    return {
      found: true,
      rowWidth: rowRect.width,
      buttons: btnRects,
      isSideBySide: btnRects.length === 2 && Math.abs(btnRects[0].top - btnRects[1].top) < 2
    };
  });
  console.log('Desktop Ticket Booking Check:', JSON.stringify(bookingCheckDesktop, null, 2));

  // Check Google Maps embed
  const mapCheckDesktop = await page.evaluate(() => {
    const container = document.querySelector('.rh-venue-map-embed-container');
    const iframe = container ? container.querySelector('iframe.rh-venue-map-iframe') : null;
    const infoBox = document.querySelector('.rh-venue-info-box');
    const openBtn = document.querySelector('a.rh-btn-crimson[href*="google.com/maps"]');
    const rect = container ? container.getBoundingClientRect() : null;
    return {
      containerFound: !!container,
      iframeFound: !!iframe,
      iframeSrc: iframe ? iframe.src : null,
      width: rect ? rect.width : 0,
      height: rect ? rect.height : 0,
      infoBoxText: infoBox ? infoBox.textContent.replace(/\s+/g, ' ').trim() : null,
      openBtnHref: openBtn ? openBtn.getAttribute('href') : null
    };
  });
  console.log('Desktop Google Maps Check:', JSON.stringify(mapCheckDesktop, null, 2));

  // Capture full desktop page and specific cards
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'concert-detail-desktop-full.png'),
    fullPage: false
  });

  const bookingCard = await page.evaluateHandle(() => {
    const row = document.querySelector('.rh-booking-actions-row');
    return row ? row.closest('.rh-editorial-card') : null;
  });
  if (bookingCard && bookingCard.asElement()) {
    await bookingCard.asElement().screenshot({
      path: path.join(ARTIFACTS_DIR, 'ticket-booking-card-desktop.png')
    });
    console.log('Captured ticket-booking-card-desktop.png');
  }

  const mapCard = await page.evaluateHandle(() => {
    const container = document.querySelector('.rh-venue-map-embed-container');
    return container ? container.closest('.rh-editorial-card') : null;
  });
  if (mapCard && mapCard.asElement()) {
    await mapCard.asElement().screenshot({
      path: path.join(ARTIFACTS_DIR, 'venue-map-card-desktop.png')
    });
    console.log('Captured venue-map-card-desktop.png');
  }

  // 4. Verify Concert Details Page on Mobile (390x844)
  console.log('\n--- 4. Testing Concert Details Page (Mobile 390x844) ---');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:3000/concerts/6aec50df716ae22e5aa1797f', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  const bookingCheckMobile390 = await page.evaluate(() => {
    const row = document.querySelector('.rh-booking-actions-row');
    if (!row) return { found: false };
    const btns = Array.from(row.querySelectorAll('.rh-booking-btn'));
    const rowRect = row.getBoundingClientRect();
    const btnRects = btns.map(b => {
      const r = b.getBoundingClientRect();
      const style = window.getComputedStyle(b);
      return {
        text: b.textContent.trim(),
        width: r.width,
        height: r.height,
        top: r.top,
        whiteSpace: style.whiteSpace
      };
    });
    return {
      found: true,
      rowWidth: rowRect.width,
      buttons: btnRects,
      isSideBySide: btnRects.length === 2 && Math.abs(btnRects[0].top - btnRects[1].top) < 2
    };
  });
  console.log('Mobile 390px Ticket Booking Check:', JSON.stringify(bookingCheckMobile390, null, 2));

  const bookingCardMobile = await page.evaluateHandle(() => {
    const row = document.querySelector('.rh-booking-actions-row');
    return row ? row.closest('.rh-editorial-card') : null;
  });
  if (bookingCardMobile && bookingCardMobile.asElement()) {
    await bookingCardMobile.asElement().screenshot({
      path: path.join(ARTIFACTS_DIR, 'ticket-booking-card-mobile-390px.png')
    });
    console.log('Captured ticket-booking-card-mobile-390px.png');
  }

  const mapCardMobile = await page.evaluateHandle(() => {
    const container = document.querySelector('.rh-venue-map-embed-container');
    return container ? container.closest('.rh-editorial-card') : null;
  });
  if (mapCardMobile && mapCardMobile.asElement()) {
    await mapCardMobile.asElement().screenshot({
      path: path.join(ARTIFACTS_DIR, 'venue-map-card-mobile-390px.png')
    });
    console.log('Captured venue-map-card-mobile-390px.png');
  }

  // 5. Verify Concert Details Page on Small Mobile (360x740)
  console.log('\n--- 5. Testing Concert Details Page (Small Mobile 360x740) ---');
  await page.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:3000/concerts/6aec50df716ae22e5aa1797f', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  const bookingCheckMobile360 = await page.evaluate(() => {
    const row = document.querySelector('.rh-booking-actions-row');
    if (!row) return { found: false };
    const btns = Array.from(row.querySelectorAll('.rh-booking-btn'));
    const btnRects = btns.map(b => {
      const r = b.getBoundingClientRect();
      const style = window.getComputedStyle(b);
      return {
        text: b.textContent.trim(),
        width: r.width,
        height: r.height,
        top: r.top,
        whiteSpace: style.whiteSpace
      };
    });
    return {
      found: true,
      buttons: btnRects,
      isSideBySide: btnRects.length === 2 && Math.abs(btnRects[0].top - btnRects[1].top) < 2
    };
  });
  console.log('Small Mobile 360px Ticket Booking Check:', JSON.stringify(bookingCheckMobile360, null, 2));

  const bookingCardMobile360 = await page.evaluateHandle(() => {
    const row = document.querySelector('.rh-booking-actions-row');
    return row ? row.closest('.rh-editorial-card') : null;
  });
  if (bookingCardMobile360 && bookingCardMobile360.asElement()) {
    await bookingCardMobile360.asElement().screenshot({
      path: path.join(ARTIFACTS_DIR, 'ticket-booking-card-mobile-360px.png')
    });
    console.log('Captured ticket-booking-card-mobile-360px.png');
  }

  console.log('\nAll checks and screenshots completed successfully!');
  await browser.close();
})();

