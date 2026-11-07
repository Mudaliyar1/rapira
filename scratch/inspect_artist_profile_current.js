const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const PROFILE_URL = 'http://localhost:3000/artists/699b435b1d3cc57e880c8ccd';

async function inspectProfile() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_profile_inspect_'));
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tempDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
    await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    const data = await page.evaluate(() => {
      const banner = document.querySelector('.rh-ap-banner-wrap');
      const avatar = document.querySelector('.rh-ap-avatar-wrap');
      const tabsWrap = document.querySelector('.rh-ap-tabs-wrapper');
      const tabs = Array.from(document.querySelectorAll('.rh-ap-tab-btn')).map(b => ({
        text: b.textContent.trim(),
        top: b.offsetTop,
        left: b.offsetLeft,
        width: b.offsetWidth,
        height: b.offsetHeight
      }));
      const postCards = Array.from(document.querySelectorAll('.rh-ap-post-card')).map(c => ({
        width: c.offsetWidth,
        height: c.offsetHeight,
        top: c.offsetTop,
        left: c.offsetLeft,
        parentClass: c.parentElement?.className
      }));

      return {
        banner: banner ? { width: banner.offsetWidth, height: banner.offsetHeight } : null,
        avatar: avatar ? { width: avatar.offsetWidth, height: avatar.offsetHeight, marginTop: window.getComputedStyle(avatar).marginTop } : null,
        tabsWrap: tabsWrap ? { width: tabsWrap.offsetWidth, scrollWidth: tabsWrap.scrollWidth } : null,
        tabs,
        postCardsCount: postCards.length,
        postCardsSample: postCards.slice(0, 4)
      };
    });

    console.log('CURRENT INSPECTION:', JSON.stringify(data, null, 2));

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'artist-profile-mobile-baseline.png'), fullPage: false });
    console.log('Saved artist-profile-mobile-baseline.png');
  } catch (err) {
    console.error('Error during inspect:', err);
  } finally {
    await browser.close();
  }
}

inspectProfile();

