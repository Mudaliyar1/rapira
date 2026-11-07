const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

async function testMobileNav() {
  console.log('Testing Mobile Navbar Search and Dropdown Alignment...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Test across all requested viewports
  const viewports = [
    { name: '360px', width: 360, height: 740 },
    { name: '375px', width: 375, height: 667 },
    { name: '390px', width: 390, height: 844 },
    { name: '414px', width: 414, height: 896 },
    { name: '768px', width: 768, height: 900 },
    { name: '1440px', width: 1440, height: 900 }
  ];

  for (const vp of viewports) {
    console.log(`\n=== Testing Viewport: ${vp.name} ===`);
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));

    // Check search icon in DOM
    const searchCheck = await page.evaluate(() => {
      const searchIcon = document.getElementById('navSearchIcon');
      const searchIconsInNavbar = document.querySelectorAll('#navbarMain .bi-search');
      // only find-my-artist inside dropdown-item has bi-search
      const topLevelSearch = Array.from(document.querySelectorAll('#navbarMain > ul > li')).filter(li => {
        return li.querySelector('.bi-search');
      });
      return {
        hasNavSearchId: !!searchIcon,
        topLevelSearchCount: topLevelSearch.length,
        hasHorizScroll: document.documentElement.scrollWidth > window.innerWidth
      };
    });
    console.log(`${vp.name} Search & Overflow Check:`, searchCheck);

    if (vp.width <= 768) {
      // Open mobile toggler
      await page.click('.navbar-toggler');
      await new Promise(r => setTimeout(r, 500));

      // Inspect dropdown triggers alignment
      const triggerMetrics = await page.evaluate(() => {
        const triggers = Array.from(document.querySelectorAll('#navbarMain .nav-link.dropdown-toggle'));
        return triggers.map(t => {
          const rect = t.getBoundingClientRect();
          const label = t.querySelector('.rh-nav-label');
          const labelRect = label ? label.getBoundingClientRect() : null;
          const s = window.getComputedStyle(t);
          return {
            id: t.id,
            text: t.innerText.trim(),
            display: s.display,
            justifyContent: s.justifyContent,
            height: Math.round(rect.height),
            width: Math.round(rect.width),
            labelLeft: labelRect ? Math.round(labelRect.left) : null,
            labelWidth: labelRect ? Math.round(labelRect.width) : null,
            textDecoration: s.textDecoration
          };
        });
      });
      console.log(`${vp.name} Dropdown Triggers:`, JSON.stringify(triggerMetrics, null, 2));
    }
  }

  // Visual capture at 375px
  await page.setViewport({ width: 375, height: 750 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  // Open mobile navbar
  await page.click('.navbar-toggler');
  await new Promise(r => setTimeout(r, 500));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-nav-all-aligned.png'),
    clip: { x: 0, y: 0, width: 375, height: 420 }
  });
  console.log('Saved mobile-nav-all-aligned.png');

  // Test expanding Help & Support
  await page.click('#helpDropdown');
  await new Promise(r => setTimeout(r, 500));

  const helpMetrics = await page.evaluate(() => {
    const trigger = document.getElementById('helpDropdown');
    const menu = trigger.nextElementSibling;
    const s = window.getComputedStyle(trigger);
    const after = window.getComputedStyle(trigger, '::after');
    const menuRect = menu ? menu.getBoundingClientRect() : null;
    return {
      expanded: trigger.getAttribute('aria-expanded'),
      textDecoration: s.textDecoration,
      transform: after.transform,
      menuVisible: menu && menu.classList.contains('show'),
      menuWidth: menuRect ? Math.round(menuRect.width) : null
    };
  });
  console.log('Help & Support Expanded State:', helpMetrics);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-nav-help-expanded.png'),
    clip: { x: 0, y: 0, width: 375, height: 700 }
  });
  console.log('Saved mobile-nav-help-expanded.png');

  // Test expanding Discover
  await page.click('#discoverDropdown');
  await new Promise(r => setTimeout(r, 500));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-nav-discover-expanded.png'),
    clip: { x: 0, y: 0, width: 375, height: 600 }
  });
  console.log('Saved mobile-nav-discover-expanded.png');

  // Test Desktop at 1440px
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  const desktopNavMetrics = await page.evaluate(() => {
    const triggers = Array.from(document.querySelectorAll('#navbarMain .nav-link.dropdown-toggle'));
    return triggers.map(t => ({
      text: t.innerText.trim(),
      display: window.getComputedStyle(t).display,
      arrowMarginLeft: window.getComputedStyle(t, '::after').marginLeft
    }));
  });
  console.log('Desktop Nav Triggers:', desktopNavMetrics);

  const navEl = await page.$('nav.navbar');
  if (navEl) {
    await navEl.screenshot({
      path: path.join(ARTIFACT_DIR, 'desktop-navbar-aligned.png')
    });
    console.log('Saved desktop-navbar-aligned.png');
  }

  await browser.close();
  console.log('\nAll tests completed successfully!');
}

testMobileNav().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

