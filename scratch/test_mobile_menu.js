const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const HOMEPAGE_URL = 'http://localhost:3000/';

async function testMobileMenu() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(HOMEPAGE_URL, { waitUntil: 'networkidle2' });

    console.log('Homepage loaded.');

    // Click navbar toggler
    await page.click('.navbar-toggler');
    await page.waitForSelector('#navbarMain.show', { timeout: 5000 });
    console.log('Navbar opened.');

    // Inspect navbar state
    let state1 = await page.evaluate(() => {
      const el = document.getElementById('navbarMain');
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        rect: { top: rect.top, bottom: rect.bottom, height: rect.height },
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowY: style.overflowY,
        maxHeight: style.maxHeight,
        windowHeight: window.innerHeight
      };
    });
    console.log('State with dropdowns closed:', JSON.stringify(state1, null, 2));

    // Click Help & Support dropdown
    await page.click('#helpDropdown');
    await new Promise(r => setTimeout(r, 500));

    let state2 = await page.evaluate(() => {
      const el = document.getElementById('navbarMain');
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const auth = document.querySelector('.auth-buttons-container');
      const authRect = auth ? auth.getBoundingClientRect() : null;
      const chatbot = document.getElementById('chatbot-toggle');
      const chatbotRect = chatbot ? chatbot.getBoundingClientRect() : null;

      return {
        rect: { top: rect.top, bottom: rect.bottom, height: rect.height },
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowY: style.overflowY,
        maxHeight: style.maxHeight,
        windowHeight: window.innerHeight,
        authVisible: authRect ? (authRect.bottom <= window.innerHeight && authRect.top >= 0) : false,
        authRect: authRect ? { top: authRect.top, bottom: authRect.bottom } : null,
        chatbotRect: chatbotRect ? { top: chatbotRect.top, bottom: chatbotRect.bottom, right: chatbotRect.right } : null
      };
    });
    console.log('State with Help & Support expanded:', JSON.stringify(state2, null, 2));

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'current-mobile-menu-help-open.png'),
      fullPage: false
    });
    console.log('Saved current-mobile-menu-help-open.png');

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
  }
}

testMobileMenu();
