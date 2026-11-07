const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const PROFILE_URL = 'http://localhost:3000/artists/699b435b1d3cc57e880c8ccd';

async function runQA() {
  console.log('[QA] Starting Comprehensive Artist Profile Responsive QA...');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_profile_qa_'));

  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tempDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const results = [];

  try {
    const viewports = [
      { name: 'Mobile 360px', width: 360, height: 740 },
      { name: 'Mobile 375px', width: 375, height: 812 },
      { name: 'Mobile 390px', width: 390, height: 844 },
      { name: 'Mobile 414px', width: 414, height: 896 },
      { name: 'Tablet 768px', width: 768, height: 1024 },
      { name: 'Laptop 1024px', width: 1024, height: 768 },
      { name: 'Desktop 1440px', width: 1440, height: 900 }
    ];

    for (const vp of viewports) {
      console.log(`\n--- Testing ${vp.name} (${vp.width}x${vp.height}) ---`);
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
      await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 30000 });

      const check = await page.evaluate((width) => {
        // 1. Horizontal overflow
        const docScrollWidth = document.documentElement.scrollWidth;
        const bodyScrollWidth = document.body.scrollWidth;
        const hasHorizontalOverflow = docScrollWidth > width || bodyScrollWidth > width;

        // 2. Tabs Wrapping Check
        const tabBtns = Array.from(document.querySelectorAll('.rh-ap-tab-btn'));
        const tabTops = tabBtns.map(b => b.offsetTop);
        const tabsWrapped = (Math.max(...tabTops) - Math.min(...tabTops)) > 5;

        // 3. Header Action buttons row
        const actionBtns = Array.from(document.querySelectorAll('.rh-ap-actions-row > *'));
        const actionTops = actionBtns.map(b => b.offsetTop);
        const actionsWrapped = (Math.max(...actionTops) - Math.min(...actionTops)) > 5;

        // 4. Post cards layout
        const postCards = Array.from(document.querySelectorAll('.rh-ap-post-card'));
        const postCols = [];
        if (postCards.length >= 2) {
          const top0 = postCards[0].offsetTop;
          const cardsInFirstRow = postCards.filter(c => Math.abs(c.offsetTop - top0) < 10);
          postCols.push(cardsInFirstRow.length);
        }

        // 5. Header Dimensions
        const banner = document.querySelector('.rh-ap-banner-wrap');
        const avatar = document.querySelector('.rh-ap-avatar-wrap');

        return {
          width,
          docScrollWidth,
          hasHorizontalOverflow,
          tabsCount: tabBtns.length,
          tabsWrapped,
          tabTops,
          actionsCount: actionBtns.length,
          actionsWrapped,
          firstRowCardsCount: postCols[0] || 0,
          bannerHeight: banner ? banner.offsetHeight : 0,
          avatarHeight: avatar ? avatar.offsetHeight : 0
        };
      }, vp.width);

      console.log(`[QA] ${vp.name} results:`, JSON.stringify(check, null, 2));
      results.push({ ...vp, ...check });

      // Take screenshots for mobile 375px and desktop 1440px
      if (vp.width === 375) {
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'artist-profile-mobile-375px-top.png'), fullPage: false });
        // Scroll to posts
        await page.evaluate(() => {
          document.querySelector('.rh-ap-tabs-wrapper')?.scrollIntoView({ behavior: 'instant' });
        });
        await new Promise(r => setTimeout(r, 400));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'artist-profile-mobile-375px-posts.png'), fullPage: false });
        console.log('[QA] Captured mobile screenshots');

        // Test tab switching
        console.log('[QA] Testing tab switching on mobile...');
        await page.click('#tab-concerts-btn');
        await new Promise(r => setTimeout(r, 400));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'artist-profile-mobile-375px-concerts.png'), fullPage: false });

        await page.click('#tab-community-btn');
        await new Promise(r => setTimeout(r, 400));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'artist-profile-mobile-375px-community.png'), fullPage: false });

        await page.click('#tab-about-btn');
        await new Promise(r => setTimeout(r, 400));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'artist-profile-mobile-375px-about.png'), fullPage: false });

        await page.click('#tab-posts-btn');
        await new Promise(r => setTimeout(r, 400));
      }

      if (vp.width === 1440) {
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'artist-profile-desktop-1440px.png'), fullPage: false });
        console.log('[QA] Captured desktop screenshot');
      }

      await page.close();
    }

    console.log('\n================ ALL QA RESULTS ================');
    console.table(results.map(r => ({
      Viewport: r.name,
      'No Overflow': !r.hasHorizontalOverflow,
      'Tabs Single Row': !r.tabsWrapped,
      'Actions Single Row': !r.actionsWrapped,
      'Columns in Row 1': r.firstRowCardsCount,
      'Banner H': r.bannerHeight,
      'Avatar H': r.avatarHeight
    })));

  } catch (err) {
    console.error('[QA] Error:', err);
  } finally {
    await browser.close();
  }
}

runQA();

