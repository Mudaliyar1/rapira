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

  console.log('=== TEST 1: NAVBAR SEARCH REMOVAL ===');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 800));

  const navSearchDesktop = await page.evaluate(() => {
    const searchEl = document.getElementById('navSearchIcon');
    const searchInNav = document.querySelector('.navbar .bi-search');
    const authContainer = document.querySelector('.auth-buttons-container');
    const brand = document.querySelector('.navbar-brand');
    const links = Array.from(document.querySelectorAll('.navbar-nav .nav-link')).map(l => l.innerText.trim()).filter(Boolean);
    return {
      searchElementFound: !!searchEl,
      searchElementVisible: searchEl ? window.getComputedStyle(searchEl).display !== 'none' : false,
      searchIconInNav: !!searchInNav,
      brandText: brand ? brand.innerText.trim() : null,
      links,
      authVisible: !!authContainer
    };
  });
  console.log('Desktop Navbar Search Check:', navSearchDesktop);

  // Capture desktop navbar screenshot
  const navbarEl = await page.$('.navbar');
  if (navbarEl) {
    await navbarEl.screenshot({
      path: path.join(ARTIFACT_DIR, 'navbar-search-removed-desktop.png')
    });
    console.log('Saved: navbar-search-removed-desktop.png');
  }

  // Mobile navbar search check
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 600));

  const navSearchMobile = await page.evaluate(() => {
    const searchEl = document.getElementById('navSearchIcon');
    const searchInNav = document.querySelector('.navbar .bi-search');
    return {
      searchElementVisible: searchEl ? window.getComputedStyle(searchEl).display !== 'none' : false,
      searchIconInNav: !!searchInNav
    };
  });
  console.log('Mobile Navbar Search Check:', navSearchMobile);

  const mobNavbarEl = await page.$('.navbar');
  if (mobNavbarEl) {
    await mobNavbarEl.screenshot({
      path: path.join(ARTIFACT_DIR, 'navbar-search-removed-mobile.png')
    });
    console.log('Saved: navbar-search-removed-mobile.png');
  }

  console.log('\n=== TEST 2: MOBILE HERO CTA BUTTONS (360px - 414px) ===');
  const mobileWidths = [360, 375, 390, 414];
  for (const w of mobileWidths) {
    await page.setViewport({ width: w, height: 812 });
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 500));

    const btnInfo = await page.evaluate((width) => {
      const group = document.querySelector('.rh-hero-cta-group');
      const btn1 = document.querySelector('.rh-btn-crimson-solid');
      const btn2 = document.querySelector('.rh-btn-outline-pill');
      const scrollW = document.documentElement.scrollWidth;

      if (!group || !btn1 || !btn2) return { error: 'elements not found' };

      const gRect = group.getBoundingClientRect();
      const r1 = btn1.getBoundingClientRect();
      const r2 = btn2.getBoundingClientRect();

      const sameRow = Math.abs(r1.top - r2.top) < 4;
      const equalHeight = Math.abs(r1.height - r2.height) < 2;
      const gap = Math.round(r2.left - r1.right);
      const groupCenter = gRect.left + gRect.width / 2;
      const screenCenter = width / 2;
      const centered = Math.abs(groupCenter - screenCenter) < 4;

      return {
        width,
        scrollW,
        hasOverflow: scrollW > width,
        sameRow,
        equalHeight,
        gap,
        btn1: {
          text: btn1.innerText.trim(),
          width: Math.round(r1.width),
          height: Math.round(r1.height)
        },
        btn2: {
          text: btn2.innerText.trim(),
          width: Math.round(r2.width),
          height: Math.round(r2.height)
        },
        centered,
        btn1Bg: window.getComputedStyle(btn1).backgroundColor,
        btn2Bg: window.getComputedStyle(btn2).backgroundColor,
        btn2Border: window.getComputedStyle(btn2).borderColor
      };
    }, w);

    console.log(`Mobile ${w}px Hero Buttons:`, JSON.stringify(btnInfo, null, 2));
  }

  // Capture mobile hero buttons screenshot at 375px
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 500));

  const heroCenter = await page.$('.rh-hero-center-content');
  if (heroCenter) {
    const box = await heroCenter.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'mobile-hero-buttons-side-by-side.png'),
        clip: {
          x: 0,
          y: Math.max(0, box.y - 10),
          width: 375,
          height: box.height + 20
        }
      });
      console.log('Saved: mobile-hero-buttons-side-by-side.png');
    }
  }

  console.log('\n=== TEST 3: HERO CAROUSEL HEIGHT AUDIT ACROSS BREAKPOINTS ===');
  const allViewports = [360, 375, 390, 414, 768, 1024, 1440];
  for (const w of allViewports) {
    await page.setViewport({ width: w, height: 850 });
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 500));

    const carouselDim = await page.evaluate(() => {
      const banner = document.querySelector('.rh-hero-banner-container');
      if (!banner) return null;
      const rect = banner.getBoundingClientRect();
      const style = window.getComputedStyle(banner);
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        borderRadius: style.borderRadius
      };
    });
    console.log(`Viewport ${w}px - Carousel dimensions:`, carouselDim);
  }

  console.log('\n=== TEST 4: ALL 4 CAROUSEL SLIDES VERIFICATION & SCREENSHOTS ===');
  // Desktop 1440px
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 800));

  const totalSlides = await page.evaluate(() => {
    return document.querySelectorAll('#mainCarousel .carousel-item').length;
  });
  console.log('Total slides in mainCarousel:', totalSlides);

  const bannerEl = await page.$('.rh-hero-banner-container');

  // Capture each slide on Desktop
  for (let i = 0; i < totalSlides; i++) {
    await page.evaluate((idx) => {
      const carousel = document.querySelector('#mainCarousel');
      const bsCarousel = bootstrap.Carousel.getOrCreateInstance(carousel);
      bsCarousel.to(idx);
    }, i);
    await new Promise(r => setTimeout(r, 800));

    const slideAudit = await page.evaluate((idx) => {
      const items = document.querySelectorAll('#mainCarousel .carousel-item');
      const item = items[idx];
      const img = item.querySelector('.rh-slide-img');
      const cs = window.getComputedStyle(img);
      return {
        index: idx,
        imgSrc: img.getAttribute('src'),
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        renderedWidth: img.clientWidth,
        renderedHeight: img.clientHeight,
        objectFit: cs.objectFit,
        objectPosition: cs.objectPosition,
        itemBg: window.getComputedStyle(item).backgroundColor
      };
    });
    console.log(`Desktop Slide ${i}:`, slideAudit);

    if (bannerEl) {
      await bannerEl.screenshot({
        path: path.join(ARTIFACT_DIR, `carousel-slide${i}-desktop.png`)
      });
      console.log(`Saved: carousel-slide${i}-desktop.png`);
    }
  }

  // Capture each slide on Mobile (375px)
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 800));

  const bannerElMob = await page.$('.rh-hero-banner-container');

  for (let i = 0; i < totalSlides; i++) {
    await page.evaluate((idx) => {
      const carousel = document.querySelector('#mainCarousel');
      const bsCarousel = bootstrap.Carousel.getOrCreateInstance(carousel);
      bsCarousel.to(idx);
    }, i);
    await new Promise(r => setTimeout(r, 800));

    const slideAudit = await page.evaluate((idx) => {
      const items = document.querySelectorAll('#mainCarousel .carousel-item');
      const item = items[idx];
      const img = item.querySelector('.rh-slide-img');
      const cs = window.getComputedStyle(img);
      return {
        index: idx,
        renderedWidth: img.clientWidth,
        renderedHeight: img.clientHeight,
        objectFit: cs.objectFit,
        objectPosition: cs.objectPosition
      };
    });
    console.log(`Mobile (375px) Slide ${i}:`, slideAudit);

    if (bannerElMob) {
      await bannerElMob.screenshot({
        path: path.join(ARTIFACT_DIR, `carousel-slide${i}-mobile.png`)
      });
      console.log(`Saved: carousel-slide${i}-mobile.png`);
    }
  }

  // Full page overview screenshots
  console.log('\n=== TEST 5: CAPTURE FULL PAGE OVERVIEWS ===');
  // Desktop
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'desktop-homepage-overview.png'),
    clip: { x: 0, y: 0, width: 1440, height: 950 }
  });
  console.log('Saved: desktop-homepage-overview.png');

  // Tablet
  await page.setViewport({ width: 768, height: 1024 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'tablet-homepage-overview.png'),
    clip: { x: 0, y: 0, width: 768, height: 850 }
  });
  console.log('Saved: tablet-homepage-overview.png');

  // Mobile
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-homepage-overview.png'),
    clip: { x: 0, y: 0, width: 375, height: 750 }
  });
  console.log('Saved: mobile-homepage-overview.png');

  await browser.close();
  console.log('\n=== ALL TESTS AND SCREENSHOTS COMPLETED! ===');
})();

