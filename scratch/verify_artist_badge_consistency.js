const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

async function runBadgeConsistencyQA() {
  console.log('=== STARTING ARTIST BADGE CONSISTENCY QA ===');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const audit = {
    timestamp: new Date().toISOString(),
    homepage: null,
    artistsDesktop: null,
    artistsTablet: null,
    artistsMobile: null,
    comparison: null,
    screenshots: []
  };

  const page = await browser.newPage();

  // 1. Inspect Homepage Artist Cards
  console.log('[1/4] Inspecting Homepage Artist Badges at 1440px...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });

  // Scroll to artists section
  await page.evaluate(() => {
    const artistSec = document.querySelector('.rh-artists-section') || document.querySelector('#artists') || document.querySelector('.rh-artist-card');
    if (artistSec) artistSec.scrollIntoView();
  });
  await new Promise(r => setTimeout(r, 600));

  audit.homepage = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.rh-artist-card'));
    const verifiedCards = cards.filter(c => c.querySelector('.rh-verified-pill'));
    const unverifiedCards = cards.filter(c => !c.querySelector('.rh-verified-pill'));

    let pillStyles = null;
    let svgStyles = null;
    if (verifiedCards.length > 0) {
      const pill = verifiedCards[0].querySelector('.rh-verified-pill');
      const cs = window.getComputedStyle(pill);
      const svg = pill.querySelector('svg');
      const svgCs = svg ? window.getComputedStyle(svg) : null;

      pillStyles = {
        text: pill.innerText.trim(),
        backgroundColor: cs.backgroundColor,
        color: cs.color,
        borderRadius: cs.borderRadius,
        padding: cs.padding,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        fontFamily: cs.fontFamily,
        display: cs.display,
        gap: cs.gap,
        position: cs.position,
        top: cs.top,
        right: cs.right,
        zIndex: cs.zIndex,
        boxShadow: cs.boxShadow
      };

      if (svg) {
        svgStyles = {
          width: svgCs ? svgCs.width : svg.getAttribute('width'),
          height: svgCs ? svgCs.height : svg.getAttribute('height'),
          fill: svgCs ? svgCs.fill : null,
          viewBox: svg.getAttribute('viewBox'),
          dStartsWith: svg.querySelector('path')?.getAttribute('d')?.substring(0, 20)
        };
      }
    }

    return {
      totalCards: cards.length,
      verifiedCount: verifiedCards.length,
      unverifiedCount: unverifiedCards.length,
      firstVerifiedArtist: verifiedCards[0]?.querySelector('.rh-artist-name')?.innerText.trim(),
      pillStyles,
      svgStyles
    };
  });

  const hpScreenshot = 'artist-badge-homepage-desktop.png';
  // Capture section screenshot if found
  const artistSecHandle = await page.$('.rh-artists-section') || await page.$('.rh-artist-card');
  if (artistSecHandle) {
    await artistSecHandle.screenshot({ path: path.join(ARTIFACT_DIR, hpScreenshot) });
  } else {
    await page.screenshot({ path: path.join(ARTIFACT_DIR, hpScreenshot) });
  }
  audit.screenshots.push(hpScreenshot);
  console.log('Homepage badge audit:', JSON.stringify(audit.homepage, null, 2));

  // 2. Inspect Discover Artists Page (Desktop 1440px)
  console.log('[2/4] Inspecting Discover Artists Page Badges at 1440px...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/artists', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  audit.artistsDesktop = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.rh-da-card'));
    const verifiedCards = cards.filter(c => c.querySelector('.rh-verified-pill') || c.getAttribute('data-verified') === 'true');
    const unverifiedCards = cards.filter(c => c.getAttribute('data-verified') === 'false');

    let pillStyles = null;
    let svgStyles = null;
    let firstVerified = verifiedCards.find(c => c.querySelector('.rh-verified-pill'));

    if (firstVerified) {
      const pill = firstVerified.querySelector('.rh-verified-pill');
      const cs = window.getComputedStyle(pill);
      const svg = pill.querySelector('svg');
      const svgCs = svg ? window.getComputedStyle(svg) : null;

      pillStyles = {
        text: pill.innerText.trim(),
        backgroundColor: cs.backgroundColor,
        color: cs.color,
        borderRadius: cs.borderRadius,
        padding: cs.padding,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        fontFamily: cs.fontFamily,
        display: cs.display,
        gap: cs.gap,
        position: cs.position,
        top: cs.top,
        right: cs.right,
        zIndex: cs.zIndex,
        boxShadow: cs.boxShadow
      };

      if (svg) {
        svgStyles = {
          width: svgCs ? svgCs.width : svg.getAttribute('width'),
          height: svgCs ? svgCs.height : svg.getAttribute('height'),
          fill: svgCs ? svgCs.fill : null,
          viewBox: svg.getAttribute('viewBox'),
          dStartsWith: svg.querySelector('path')?.getAttribute('d')?.substring(0, 20)
        };
      }
    }

    // Verify unverified cards have NO pill
    const unverifiedHasBadge = unverifiedCards.some(c => c.querySelector('.rh-verified-pill'));

    return {
      totalCards: cards.length,
      verifiedCount: verifiedCards.length,
      unverifiedCount: unverifiedCards.length,
      unverifiedHasBadge,
      firstVerifiedArtist: firstVerified?.querySelector('.rh-da-card-title')?.innerText.trim(),
      pillStyles,
      svgStyles
    };
  });

  const daDeskScreenshot = 'artist-badge-discover-desktop.png';
  const daGridHandle = await page.$('.rh-da-grid') || await page.$('.rh-da-card');
  if (daGridHandle) {
    await daGridHandle.screenshot({ path: path.join(ARTIFACT_DIR, daDeskScreenshot) });
  } else {
    await page.screenshot({ path: path.join(ARTIFACT_DIR, daDeskScreenshot) });
  }
  audit.screenshots.push(daDeskScreenshot);
  console.log('Discover Artists Desktop badge audit:', JSON.stringify(audit.artistsDesktop, null, 2));

  // 3. Inspect Discover Artists Page (Tablet 768px)
  console.log('[3/4] Inspecting Discover Artists Page Badges at 768px Tablet...');
  await page.setViewport({ width: 768, height: 1024 });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  audit.artistsTablet = await page.evaluate(() => {
    const verifiedCards = Array.from(document.querySelectorAll('.rh-da-card[data-verified="true"]'));
    if (verifiedCards.length === 0) return null;

    const pill = verifiedCards[0].querySelector('.rh-verified-pill');
    if (!pill) return { hasPill: false };
    const cs = window.getComputedStyle(pill);

    return {
      hasPill: true,
      display: cs.display,
      backgroundColor: cs.backgroundColor,
      color: cs.color,
      top: cs.top,
      right: cs.right
    };
  });

  const daTabletScreenshot = 'artist-badge-discover-tablet-768px.png';
  await page.screenshot({ path: path.join(ARTIFACT_DIR, daTabletScreenshot) });
  audit.screenshots.push(daTabletScreenshot);
  console.log('Discover Artists Tablet badge audit:', JSON.stringify(audit.artistsTablet, null, 2));

  // 4. Inspect Discover Artists Page (Mobile 375px)
  console.log('[4/4] Inspecting Discover Artists Page Badges at 375px Mobile...');
  await page.setViewport({ width: 375, height: 812 });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  audit.artistsMobile = await page.evaluate(() => {
    const verifiedCards = Array.from(document.querySelectorAll('.rh-da-card[data-verified="true"]'));
    const unverifiedCards = Array.from(document.querySelectorAll('.rh-da-card[data-verified="false"]'));

    let mobileBadgeStyles = null;
    if (verifiedCards.length > 0) {
      const badge = verifiedCards[0].querySelector('.rh-da-verified-badge-mobile');
      if (badge) {
        const cs = window.getComputedStyle(badge);
        mobileBadgeStyles = {
          display: cs.display,
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          width: cs.width,
          height: cs.height,
          borderRadius: cs.borderRadius
        };
      }
    }

    const unverifiedHasMobileBadge = unverifiedCards.some(c => c.querySelector('.rh-da-verified-badge-mobile'));

    return {
      verifiedCardsCount: verifiedCards.length,
      unverifiedCardsCount: unverifiedCards.length,
      mobileBadgeStyles,
      unverifiedHasMobileBadge
    };
  });

  const daMobileScreenshot = 'artist-badge-discover-mobile-375px.png';
  await page.screenshot({ path: path.join(ARTIFACT_DIR, daMobileScreenshot) });
  audit.screenshots.push(daMobileScreenshot);
  console.log('Discover Artists Mobile badge audit:', JSON.stringify(audit.artistsMobile, null, 2));

  // 5. Compute Side-by-Side Comparison
  const hpPill = audit.homepage?.pillStyles;
  const daPill = audit.artistsDesktop?.pillStyles;

  const comparison = {
    backgroundColorMatch: hpPill?.backgroundColor === daPill?.backgroundColor,
    colorMatch: hpPill?.color === daPill?.color,
    borderRadiusMatch: hpPill?.borderRadius === daPill?.borderRadius,
    paddingMatch: hpPill?.padding === daPill?.padding,
    fontSizeMatch: hpPill?.fontSize === daPill?.fontSize,
    fontWeightMatch: hpPill?.fontWeight === daPill?.fontWeight,
    fontFamilyMatch: hpPill?.fontFamily === daPill?.fontFamily,
    textMatch: hpPill?.text === daPill?.text,
    svgPathMatch: audit.homepage?.svgStyles?.dStartsWith === audit.artistsDesktop?.svgStyles?.dStartsWith,
    noGreenBadgesRemaining: hpPill?.backgroundColor !== 'rgb(25, 135, 84)' && daPill?.backgroundColor !== 'rgb(25, 135, 84)',
    unverifiedArtistsHaveNoBadge: audit.artistsDesktop?.unverifiedHasBadge === false
  };

  audit.comparison = comparison;
  console.log('Comparison Results:', JSON.stringify(comparison, null, 2));

  // Write audit JSON to artifact dir
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'artist-badge-consistency-audit.json'),
    JSON.stringify(audit, null, 2)
  );

  await browser.close();
  console.log('=== QA COMPLETED SUCCESSFULLY ===');
}

runBadgeConsistencyQA().catch(err => {
  console.error('QA Script Error:', err);
  process.exit(1);
});

