const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const HOMEPAGE_URL = 'http://localhost:3000/';

const viewports = [
  { name: '360x800', width: 360, height: 800 },
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '414x896', width: 414, height: 896 },
  { name: '768x1024', width: 768, height: 1024 }
];

async function runTests() {
  console.log('Launching browser for comprehensive mobile navigation scroll testing...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    for (const vp of viewports) {
      console.log(`\n========================================`);
      console.log(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      console.log(`========================================`);

      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(HOMEPAGE_URL, { waitUntil: 'networkidle2' });

      // 1. Initial State
      let initialChatbot = await page.evaluate(() => {
        const cb = document.getElementById('chatbot-toggle');
        const style = cb ? window.getComputedStyle(cb) : null;
        return {
          exists: !!cb,
          opacity: style ? style.opacity : null,
          visibility: style ? style.visibility : null
        };
      });
      console.log('Initial chatbot state:', initialChatbot);

      // 2. Open Hamburger Menu
      await page.click('.navbar-toggler');
      await page.waitForSelector('#navbarMain.show', { timeout: 5000 });
      await new Promise(r => setTimeout(r, 400));

      let menuOpenState = await page.evaluate(() => {
        const el = document.getElementById('navbarMain');
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const bodyHasClass = document.body.classList.contains('rh-mobile-nav-open');
        const cb = document.getElementById('chatbot-toggle');
        const cbStyle = cb ? window.getComputedStyle(cb) : null;

        return {
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          windowHeight: window.innerHeight,
          fitsViewport: rect.bottom <= window.innerHeight,
          overflowY: style.overflowY,
          maxHeight: style.maxHeight,
          bodyHasClass,
          chatbotHidden: cbStyle ? (cbStyle.opacity === '0' || cbStyle.visibility === 'hidden') : true
        };
      });
      console.log('Menu opened (dropdowns collapsed):', menuOpenState);

      // 3. Expand Help & Support Submenu
      await page.click('#helpDropdown');
      await new Promise(r => setTimeout(r, 400));

      let helpExpandedState = await page.evaluate(() => {
        const el = document.getElementById('navbarMain');
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const auth = document.querySelector('.auth-buttons-container');
        const authRect = auth ? auth.getBoundingClientRect() : null;

        return {
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          isScrollable: el.scrollHeight > el.clientHeight,
          fitsViewport: rect.bottom <= window.innerHeight,
          windowHeight: window.innerHeight,
          overflowY: style.overflowY,
          authVisibleBeforeScroll: authRect ? (authRect.bottom <= window.innerHeight && authRect.top >= 0) : false
        };
      });
      console.log('Help & Support expanded (top):', helpExpandedState);

      if (vp.name === '390x844') {
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, 'mobile-nav-help-expanded-top.png'),
          fullPage: false
        });
        console.log('Saved mobile-nav-help-expanded-top.png');
      }

      // 4. Scroll down inside #navbarMain to bottom
      await page.evaluate(() => {
        const el = document.getElementById('navbarMain');
        el.scrollTop = el.scrollHeight;
      });
      await new Promise(r => setTimeout(r, 300));

      let scrolledState = await page.evaluate(() => {
        const el = document.getElementById('navbarMain');
        const auth = document.querySelector('.auth-buttons-container');
        const authRect = auth ? auth.getBoundingClientRect() : null;
        const cb = document.getElementById('chatbot-toggle');
        const cbStyle = cb ? window.getComputedStyle(cb) : null;

        // Check if last items are visible
        const updateLink = document.querySelector('a[href="/website-updates"]');
        const updateRect = updateLink ? updateLink.getBoundingClientRect() : null;
        const loginBtn = document.querySelector('.auth-buttons-container a[href="/auth/login"]');
        const registerBtn = document.querySelector('.auth-buttons-container a[href="/auth/register"]');

        return {
          scrollTop: el.scrollTop,
          maxScroll: el.scrollHeight - el.clientHeight,
          authVisibleAfterScroll: authRect ? (authRect.bottom <= window.innerHeight && authRect.top >= el.getBoundingClientRect().top) : false,
          updateLinkVisible: updateRect ? (updateRect.bottom <= window.innerHeight && updateRect.top >= el.getBoundingClientRect().top) : false,
          loginExists: !!loginBtn,
          registerExists: !!registerBtn,
          chatbotStillHidden: cbStyle ? (cbStyle.opacity === '0' || cbStyle.visibility === 'hidden') : true
        };
      });
      console.log('Scrolled to bottom:', scrolledState);

      if (vp.name === '390x844') {
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, 'mobile-nav-help-expanded-scrolled.png'),
          fullPage: false
        });
        console.log('Saved mobile-nav-help-expanded-scrolled.png');
      }

      // 5. Test another dropdown (Discover)
      await page.evaluate(() => {
        const el = document.getElementById('navbarMain');
        el.scrollTop = 0;
      });
      await new Promise(r => setTimeout(r, 200));

      // Close Help, open Discover
      await page.click('#helpDropdown');
      await new Promise(r => setTimeout(r, 300));
      await page.click('#discoverDropdown');
      await new Promise(r => setTimeout(r, 300));

      let discoverState = await page.evaluate(() => {
        const el = document.getElementById('navbarMain');
        const rect = el.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          fitsViewport: rect.bottom <= window.innerHeight,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight
        };
      });
      console.log('Discover expanded:', discoverState);

      if (vp.name === '390x844') {
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, 'mobile-nav-discover-expanded.png'),
          fullPage: false
        });
        console.log('Saved mobile-nav-discover-expanded.png');
      }

      // 6. Close Menu
      await page.click('.navbar-toggler');
      await new Promise(r => setTimeout(r, 500));

      let menuClosedState = await page.evaluate(() => {
        const el = document.getElementById('navbarMain');
        const bodyHasClass = document.body.classList.contains('rh-mobile-nav-open');
        const cb = document.getElementById('chatbot-toggle');
        const cbStyle = cb ? window.getComputedStyle(cb) : null;
        const bodyOverflow = window.getComputedStyle(document.body).overflow;

        return {
          menuHasShow: el.classList.contains('show'),
          bodyHasClass,
          bodyOverflow,
          chatbotRestored: cbStyle ? (cbStyle.opacity === '1' && cbStyle.visibility === 'visible') : false
        };
      });
      console.log('Menu closed state:', menuClosedState);

      if (vp.name === '390x844') {
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, 'mobile-nav-closed-chatbot-restored.png'),
          fullPage: false
        });
        console.log('Saved mobile-nav-closed-chatbot-restored.png');
      }

      await page.close();
    }

    console.log('\nAll viewport tests completed successfully!');
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await browser.close();
  }
}

runTests();

