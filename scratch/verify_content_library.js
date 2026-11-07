const puppeteer = require('d:/Nightcode/rapira/node_modules/puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const VIEWPORTS = [
  { name: 'mobile-xs-320px', width: 320, height: 600 },
  { name: 'mobile-small-360px', width: 360, height: 740 },
  { name: 'mobile-standard-375px', width: 375, height: 812 },
  { name: 'mobile-large-390px', width: 390, height: 844 },
  { name: 'mobile-phablet-414px', width: 414, height: 896 },
  { name: 'mobile-wide-480px', width: 480, height: 854 },
  { name: 'tablet-portrait-768px', width: 768, height: 1024 },
  { name: 'tablet-landscape-1024px', width: 1024, height: 768 },
  { name: 'laptop-standard-1280px', width: 1280, height: 800 },
  { name: 'desktop-standard-1440px', width: 1440, height: 900 },
  { name: 'desktop-wide-1920px', width: 1920, height: 1080 }
];

async function runVerification() {
  const tempUserDataDir = path.join(require('os').tmpdir(), 'pptr_cl_' + Date.now());
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tempUserDataDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const results = {
    url: 'http://localhost:3000/content',
    httpStatus: null,
    heroImage: null,
    heroDetails: null,
    filterDetails: null,
    cardCount: 0,
    firstCard: null,
    soundwaveCardFound: false,
    pagination: null,
    footer: null,
    searchFilterTest: null,
    viewportOverflows: [],
    screenshots: []
  };

  try {
    // 1. Initial Desktop load
    await page.setViewport({ width: 1440, height: 900 });
    const response = await page.goto('http://localhost:3000/content', { waitUntil: 'networkidle2' });
    results.httpStatus = response.status();
    await new Promise(r => setTimeout(r, 800));

    // Inspect Hero Section
    results.heroDetails = await page.evaluate(() => {
      const title = document.querySelector('.rh-cl-hero-title');
      const eyebrow = document.querySelector('.rh-cl-eyebrow');
      const crown = document.querySelector('.rh-cl-crown-doodle');
      const underline = document.querySelector('.rh-cl-eyebrow-underline');
      const flourish = document.querySelector('.rh-cl-flourish-stroke');
      const subtitle = document.querySelector('.rh-cl-hero-subtitle');
      const img = document.querySelector('.rh-cl-hero-img');

      const titleStyle = title ? window.getComputedStyle(title) : null;
      return {
        titleText: title ? title.innerText.replace(/\n/g, ' ') : null,
        titleFontFamily: titleStyle ? titleStyle.fontFamily : null,
        titleColor: titleStyle ? titleStyle.color : null,
        hasEyebrow: !!eyebrow,
        hasCrownDoodle: !!crown,
        hasUnderline: !!underline,
        hasFlourish: !!flourish,
        subtitleText: subtitle ? subtitle.innerText : null,
        imgSrc: img ? img.currentSrc : null,
        imgComplete: img ? img.complete : false,
        imgNaturalWidth: img ? img.naturalWidth : 0,
        imgNaturalHeight: img ? img.naturalHeight : 0,
        imgRenderedWidth: img ? img.offsetWidth : 0,
        imgRenderedHeight: img ? img.offsetHeight : 0
      };
    });

    // Inspect Filter Section
    results.filterDetails = await page.evaluate(() => {
      const container = document.querySelector('.rh-cl-filter-container');
      const title = document.querySelector('.rh-cl-filter-title');
      const searchInput = document.getElementById('contentSearchInput');
      const mediaSelect = document.getElementById('mediaTypeFilter');
      const sortSelect = document.getElementById('sortFilter');

      return {
        hasContainer: !!container,
        titleText: title ? title.innerText : null,
        searchInputPlaceholder: searchInput ? searchInput.placeholder : null,
        mediaSelectOptions: mediaSelect ? Array.from(mediaSelect.options).map(o => ({ value: o.value, text: o.text })) : [],
        sortSelectOptions: sortSelect ? Array.from(sortSelect.options).map(o => ({ value: o.value, text: o.text })) : []
      };
    });

    // Inspect Cards
    const cardData = await page.evaluate(() => {
      const cards = document.querySelectorAll('.rh-cl-card');
      const items = [];
      let soundwaveFound = false;

      cards.forEach((card, i) => {
        const title = card.querySelector('.rh-cl-item-title');
        const artist = card.querySelector('.rh-cl-artist-anchor');
        const badge = card.querySelector('.rh-cl-type-badge');
        const soundwave = card.querySelector('.rh-cl-soundwave-surface');
        if (soundwave) soundwaveFound = true;

        const primaryBtn = card.querySelector('.rh-cl-btn-primary');
        const downloadBtn = card.querySelector('.rh-cl-btn-outline');
        const meta = card.querySelector('.rh-cl-item-meta');

        if (i === 0) {
          items.push({
            title: title ? title.innerText.trim() : null,
            artist: artist ? artist.innerText.trim() : null,
            badge: badge ? badge.innerText.trim() : null,
            primaryBtnText: primaryBtn ? primaryBtn.innerText.trim() : null,
            downloadBtnText: downloadBtn ? downloadBtn.innerText.trim() : null,
            metaText: meta ? meta.innerText.trim() : null
          });
        }
      });

      return { count: cards.length, firstCard: items[0] || null, soundwaveFound };
    });

    results.cardCount = cardData.count;
    results.firstCard = cardData.firstCard;
    results.soundwaveCardFound = cardData.soundwaveFound;

    // Inspect Footer
    results.footer = await page.evaluate(() => {
      const footer = document.querySelector('.rapira-site-footer');
      const brand = document.querySelector('.footer-brand');
      if (!footer) return null;
      const cs = window.getComputedStyle(footer);
      const bs = brand ? window.getComputedStyle(brand) : null;
      return {
        bgColor: cs.backgroundColor,
        color: cs.color,
        brandColor: bs ? bs.color : null,
        brandFont: bs ? bs.fontFamily : null
      };
    });

    // Test live interactive search
    results.searchFilterTest = await page.evaluate(async () => {
      const input = document.getElementById('contentSearchInput');
      const cards = document.querySelectorAll('.rh-cl-grid-item');
      if (!input || cards.length === 0) return { tested: false };

      // Type first card's artist name or partial title
      const firstTitle = cards[0].getAttribute('data-title') || '';
      const testWord = firstTitle.split(' ')[0] || 'a';
      input.value = testWord;
      input.dispatchEvent(new Event('input', { bubbles: true }));

      let visibleCount = 0;
      cards.forEach(c => {
        if (!c.classList.contains('d-none')) visibleCount++;
      });

      // Clear search
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      let restoredCount = 0;
      cards.forEach(c => {
        if (!c.classList.contains('d-none')) restoredCount++;
      });

      return {
        tested: true,
        testWord,
        visibleWhenFiltered: visibleCount,
        restoredCount,
        totalCards: cards.length
      };
    });

    // Capture Full Desktop Screenshot
    const desktopScreenshotPath = path.join(ARTIFACT_DIR, 'content-library-desktop-1440px.png');
    await page.screenshot({ path: desktopScreenshotPath, fullPage: true });
    results.screenshots.push({ viewport: 'desktop-1440px', path: desktopScreenshotPath });

    // Capture Hero & Filter Desktop Viewport
    const heroFilterScreenshotPath = path.join(ARTIFACT_DIR, 'content-library-hero-filter-desktop.png');
    await page.screenshot({ path: heroFilterScreenshotPath, clip: { x: 0, y: 0, width: 1440, height: 850 } });
    results.screenshots.push({ viewport: 'hero-filter-desktop', path: heroFilterScreenshotPath });

    // Test All Viewports for Horizontal Overflow & Capture Tablet & Mobile
    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise(r => setTimeout(r, 300));

      const overflow = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const bodyWidth = document.body.scrollWidth;
        const winWidth = window.innerWidth;
        const maxScroll = Math.max(docWidth, bodyWidth);
        const hasOverflow = maxScroll > winWidth;
        const overflowPixels = Math.max(0, maxScroll - winWidth);

        // Find elements causing overflow if any
        let culprit = null;
        if (hasOverflow) {
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            const rect = el.getBoundingClientRect();
            if (rect.right > winWidth + 1) {
              culprit = `${el.tagName}.${el.className} (right: ${rect.right}px)`;
              break;
            }
          }
        }

        return {
          winWidth,
          maxScroll,
          hasOverflow,
          overflowPixels,
          culprit
        };
      });

      results.viewportOverflows.push({
        name: vp.name,
        width: vp.width,
        height: vp.height,
        ...overflow
      });

      // Capture Tablet screenshot
      if (vp.width === 768) {
        const tabletScreenshotPath = path.join(ARTIFACT_DIR, 'content-library-tablet-768px.png');
        await page.screenshot({ path: tabletScreenshotPath, fullPage: true });
        results.screenshots.push({ viewport: 'tablet-768px', path: tabletScreenshotPath });
      }

      // Capture Mobile 375px screenshot
      if (vp.width === 375) {
        const mobileScreenshotPath = path.join(ARTIFACT_DIR, 'content-library-mobile-375px.png');
        await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
        results.screenshots.push({ viewport: 'mobile-375px', path: mobileScreenshotPath });

        const mobileHeroScreenshotPath = path.join(ARTIFACT_DIR, 'content-library-mobile-hero-filter.png');
        await page.screenshot({ path: mobileHeroScreenshotPath, clip: { x: 0, y: 0, width: 375, height: 780 } });
        results.screenshots.push({ viewport: 'mobile-hero-filter', path: mobileHeroScreenshotPath });
      }
    }

    // Save results JSON
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'content_library_verification.json'), JSON.stringify(results, null, 2));
    console.log('Verification completed successfully!');
    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    await browser.close();
  }
}

runVerification();

