const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const HOMEPAGE_URL = 'http://localhost:3000/';

const viewports = [
  { name: '360', width: 360, height: 740 },
  { name: '375', width: 375, height: 812 },
  { name: '390', width: 390, height: 844 },
  { name: '414', width: 414, height: 896 }
];

async function verifyHamburger() {
  console.log('Verifying mobile hamburger icon color across viewports...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    for (const vp of viewports) {
      console.log(`\nTesting ${vp.width}px viewport...`);
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(HOMEPAGE_URL, { waitUntil: 'networkidle2' });

      // Normal state eval
      const normalEval = await page.evaluate(() => {
        const icon = document.querySelector('.navbar-toggler-icon');
        const toggler = document.querySelector('.navbar-toggler');
        const style = icon ? window.getComputedStyle(icon) : null;
        return {
          bgImage: style ? style.backgroundImage : null,
          filter: style ? style.filter : null,
          hasCrimsonStroke: style ? style.backgroundImage.includes('%239F190E') : false,
          isFilterNone: style ? style.filter === 'none' : false
        };
      });
      console.log(`${vp.width}px Normal state:`, normalEval);

      // Hover state eval
      await page.hover('.navbar-toggler');
      const hoverEval = await page.evaluate(() => {
        const icon = document.querySelector('.navbar-toggler-icon');
        const style = icon ? window.getComputedStyle(icon) : null;
        return {
          hasCrimsonStroke: style ? style.backgroundImage.includes('%239F190E') : false,
          isFilterNone: style ? style.filter === 'none' : false
        };
      });
      console.log(`${vp.width}px Hover state:`, hoverEval);

      // Expanded state eval
      await page.click('.navbar-toggler');
      await new Promise(r => setTimeout(r, 400));
      const expandedEval = await page.evaluate(() => {
        const icon = document.querySelector('.navbar-toggler-icon');
        const style = icon ? window.getComputedStyle(icon) : null;
        const toggler = document.querySelector('.navbar-toggler');
        return {
          ariaExpanded: toggler ? toggler.getAttribute('aria-expanded') : null,
          hasCrimsonStroke: style ? style.backgroundImage.includes('%239F190E') : false,
          isFilterNone: style ? style.filter === 'none' : false
        };
      });
      console.log(`${vp.width}px Expanded state:`, expandedEval);

      // Close menu
      await page.click('.navbar-toggler');
      await new Promise(r => setTimeout(r, 400));

      // Screenshots
      if (vp.width === 390) {
        // High-res close-up of toggler button
        const togglerEl = await page.$('.navbar-toggler');
        if (togglerEl) {
          await togglerEl.screenshot({
            path: path.join(ARTIFACTS_DIR, 'hamburger-icon-closeup.png')
          });
          console.log('Saved hamburger-icon-closeup.png');
        }

        // Navbar header crop
        const navbar = await page.$('nav.navbar');
        if (navbar) {
          await navbar.screenshot({
            path: path.join(ARTIFACTS_DIR, 'mobile-navbar-crimson-hamburger.png')
          });
          console.log('Saved mobile-navbar-crimson-hamburger.png');
        }
      }

      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, `mobile-header-${vp.width}px.png`),
        clip: { x: 0, y: 0, width: vp.width, height: 120 }
      });
      console.log(`Saved mobile-header-${vp.width}px.png`);

      await page.close();
    }

    console.log('\nHamburger verification completed successfully!');
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
  }
}

verifyHamburger();

