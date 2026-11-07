const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

async function run() {
  console.log('Launching browser for comprehensive verification...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Test 1: Desktop Navbar (1440x900)
  console.log('\n--- 1. Testing Desktop Navbar (1440px) ---');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));

  const desktopSearchCheck = await page.evaluate(() => {
    const searchIcon = document.getElementById('navSearchIcon');
    const searchLinks = Array.from(document.querySelectorAll('nav.navbar a')).filter(a => {
      const href = a.getAttribute('href') || '';
      const text = a.innerText.toLowerCase();
      const hasSearchIcon = a.querySelector('.bi-search');
      return (href.includes('search') || href === '/content') && hasSearchIcon;
    });
    return {
      searchIconInDOM: !!searchIcon,
      searchLinksCount: searchLinks.length,
      navbarBrandText: document.querySelector('.navbar-brand')?.innerText?.trim(),
      authButtons: Array.from(document.querySelectorAll('.auth-buttons-container a')).map(a => a.innerText.trim())
    };
  });
  console.log('Desktop Search Check:', desktopSearchCheck);

  // Screenshot desktop navbar
  const navbarElement = await page.$('nav.navbar');
  if (navbarElement) {
    await navbarElement.screenshot({
      path: path.join(ARTIFACT_DIR, 'navbar-search-removed-desktop.png')
    });
    console.log('Saved navbar-search-removed-desktop.png');
  }

  // Test 2: Hero CTA Buttons & Carousel at Mobile Viewports (360px, 375px, 390px, 414px)
  const mobileViewports = [
    { name: '360px', width: 360, height: 740 },
    { name: '375px', width: 375, height: 667 },
    { name: '390px', width: 390, height: 844 },
    { name: '414px', width: 414, height: 896 }
  ];

  console.log('\n--- 2. Testing Mobile Hero CTA Buttons & Carousel Dimensions ---');
  for (const vp of mobileViewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));

    const metrics = await page.evaluate(() => {
      const btn1 = document.querySelector('.rh-btn-crimson-solid');
      const btn2 = document.querySelector('.rh-btn-outline-pill');
      const group = document.querySelector('.rh-hero-cta-group');
      const banner = document.querySelector('.rh-hero-banner-container');
      const r1 = btn1 ? btn1.getBoundingClientRect() : null;
      const r2 = btn2 ? btn2.getBoundingClientRect() : null;
      const rg = group ? group.getBoundingClientRect() : null;
      const rb = banner ? banner.getBoundingClientRect() : null;
      const s1 = btn1 ? window.getComputedStyle(btn1) : null;
      const s2 = btn2 ? window.getComputedStyle(btn2) : null;
      const sb = banner ? window.getComputedStyle(banner) : null;

      const hasHorizScroll = document.documentElement.scrollWidth > window.innerWidth;

      return {
        hasHorizScroll,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        btn1: r1 ? {
          top: Math.round(r1.top),
          left: Math.round(r1.left),
          right: Math.round(r1.right),
          width: Math.round(r1.width),
          height: Math.round(r1.height),
          text: btn1.innerText.trim(),
          bg: s1.backgroundColor,
          color: s1.color,
          border: s1.border
        } : null,
        btn2: r2 ? {
          top: Math.round(r2.top),
          left: Math.round(r2.left),
          right: Math.round(r2.right),
          width: Math.round(r2.width),
          height: Math.round(r2.height),
          text: btn2.innerText.trim(),
          bg: s2.backgroundColor,
          color: s2.color,
          border: s2.border
        } : null,
        gap: (r1 && r2) ? Math.round(r2.left - r1.right) : null,
        isSideBySide: (r1 && r2) ? Math.abs(r1.top - r2.top) < 3 : false,
        heightDiff: (r1 && r2) ? Math.abs(r1.height - r2.height) : null,
        banner: rb ? {
          width: Math.round(rb.width),
          height: Math.round(rb.height),
          borderRadius: sb.borderRadius
        } : null
      };
    });

    console.log(`Viewport ${vp.name}:`, JSON.stringify(metrics, null, 2));

    if (vp.width === 375) {
      // Capture mobile hero screenshot
      const heroSec = await page.$('.rh-hero-section');
      if (heroSec) {
        await heroSec.screenshot({
          path: path.join(ARTIFACT_DIR, 'mobile-hero-buttons-side-by-side.png')
        });
        console.log('Saved mobile-hero-buttons-side-by-side.png');
      }

      // Capture mobile navbar screenshot
      const mobNav = await page.$('nav.navbar');
      if (mobNav) {
        await mobNav.screenshot({
          path: path.join(ARTIFACT_DIR, 'navbar-search-removed-mobile.png')
        });
        console.log('Saved navbar-search-removed-mobile.png');
      }
    }
  }

  // Test 3: Tablet (768px) and Desktop (1024px, 1440px) Carousel Height
  console.log('\n--- 3. Testing Tablet and Desktop Carousel Heights ---');
  for (const width of [768, 1024, 1440]) {
    await page.setViewport({ width, height: 900 });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));

    const bannerInfo = await page.evaluate(() => {
      const banner = document.querySelector('.rh-hero-banner-container');
      const rb = banner ? banner.getBoundingClientRect() : null;
      const sb = banner ? window.getComputedStyle(banner) : null;
      const items = Array.from(document.querySelectorAll('#mainCarousel .carousel-item'));
      return {
        width: rb ? Math.round(rb.width) : null,
        height: rb ? Math.round(rb.height) : null,
        borderRadius: sb ? sb.borderRadius : null,
        itemHeights: items.map(it => Math.round(it.getBoundingClientRect().height))
      };
    });
    console.log(`Width ${width}px Carousel:`, bannerInfo);
  }

  // Test 4: Slide-by-slide Visual Capture at 1440px and 375px
  console.log('\n--- 4. Slide-by-Slide Verification & Screenshot Capture ---');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  const totalSlides = await page.evaluate(() => {
    return document.querySelectorAll('#mainCarousel .carousel-item').length;
  });
  console.log('Total slides in carousel:', totalSlides);

  const slideNames = ['festival', 'artist-register', 'album-us', 'circlebound'];

  for (let i = 0; i < totalSlides; i++) {
    // Navigate carousel to slide i
    await page.evaluate((idx) => {
      const carouselEl = document.getElementById('mainCarousel');
      if (carouselEl && window.bootstrap && window.bootstrap.Carousel) {
        const c = window.bootstrap.Carousel.getOrCreateInstance(carouselEl, { interval: false });
        c.to(idx);
      }
    }, i);

    // Wait for transition to complete
    await new Promise(r => setTimeout(r, 900));

    const slideInfo = await page.evaluate((idx) => {
      const items = document.querySelectorAll('#mainCarousel .carousel-item');
      const item = items[idx];
      if (!item) return null;
      const img = item.querySelector('.rh-slide-img');
      const s = img ? window.getComputedStyle(img) : null;
      const bg = window.getComputedStyle(item).backgroundColor;
      return {
        index: idx,
        active: item.classList.contains('active'),
        imgSrc: img ? img.src : null,
        objectFit: s ? s.objectFit : null,
        objectPosition: s ? s.objectPosition : null,
        bgColor: bg
      };
    }, i);

    console.log(`Slide ${i} details:`, slideInfo);

    const bannerEl = await page.$('.rh-hero-banner-container');
    if (bannerEl) {
      const name = slideNames[i] || `slide-${i}`;
      await bannerEl.screenshot({
        path: path.join(ARTIFACT_DIR, `carousel-slide${i}-${name}-desktop.png`)
      });
      console.log(`Saved carousel-slide${i}-${name}-desktop.png`);
    }
  }

  // Capture slide 1 at 375px mobile
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  for (let i = 0; i < totalSlides; i++) {
    await page.evaluate((idx) => {
      const carouselEl = document.getElementById('mainCarousel');
      if (carouselEl && window.bootstrap && window.bootstrap.Carousel) {
        const c = window.bootstrap.Carousel.getOrCreateInstance(carouselEl, { interval: false });
        c.to(idx);
      }
    }, i);
    await new Promise(r => setTimeout(r, 900));

    const bannerEl = await page.$('.rh-hero-banner-container');
    if (bannerEl) {
      const name = slideNames[i] || `slide-${i}`;
      await bannerEl.screenshot({
        path: path.join(ARTIFACT_DIR, `carousel-slide${i}-${name}-mobile.png`)
      });
      console.log(`Saved carousel-slide${i}-${name}-mobile.png`);
    }
  }

  // Desktop Overview
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'desktop-homepage-overview.png'),
    clip: { x: 0, y: 0, width: 1440, height: 850 }
  });
  console.log('Saved desktop-homepage-overview.png');

  // Mobile Overview (375x812)
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-homepage-overview.png'),
    clip: { x: 0, y: 0, width: 375, height: 750 }
  });
  console.log('Saved mobile-homepage-overview.png');

  await browser.close();
  console.log('Verification completed successfully!');
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});

