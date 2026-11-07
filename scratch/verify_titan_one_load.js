const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Track failed network requests
  const networkErrors = [];
  page.on('requestfailed', req => {
    networkErrors.push(`${req.method()} ${req.url()}: ${req.failure().errorText}`);
  });
  page.on('response', res => {
    if (res.url().includes('font')) {
      console.log(`Font HTTP Response: ${res.status()} ${res.url()}`);
    }
  });

  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  const result = await page.evaluate(async () => {
    // 1. Check if Titan One font is recognized and loaded
    const isFontLoaded = document.fonts.check('1em "Titan One"');
    const loadPromise = await document.fonts.load('1em "Titan One"');

    // 2. Computed font-family on key headings
    const heroHeadline = document.querySelector('.rh-hero-headline');
    const sectionTitle = document.querySelector('.rh-section-title');
    const howHeadline = document.querySelector('.rh-how-headline');
    const cardTitle = document.querySelector('.rh-card-title');
    const cardNumber = document.querySelector('.rh-card-number');
    const artistCta = document.querySelector('.rh-artist-cta-title');
    const navBrand = document.querySelector('.navbar-brand span');
    const footerBrand = document.querySelector('.footer-brand');

    const getComputed = (el) => {
      if (!el) return null;
      const s = window.getComputedStyle(el);
      return {
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing
      };
    };

    const fontFaces = [];
    document.fonts.forEach(f => {
      if (f.family.includes('Titan') || f.family.includes('Notre') || f.family.includes('Tanker')) {
        fontFaces.push({
          family: f.family,
          status: f.status
        });
      }
    });

    return {
      isFontLoaded,
      fontFaces,
      headings: {
        heroHeadline: getComputed(heroHeadline),
        sectionTitle: getComputed(sectionTitle),
        howHeadline: getComputed(howHeadline),
        cardTitle: getComputed(cardTitle),
        cardNumber: getComputed(cardNumber),
        artistCta: getComputed(artistCta),
        navBrand: getComputed(navBrand),
        footerBrand: getComputed(footerBrand)
      }
    };
  });

  console.log('\nVerification Result:', JSON.stringify(result, null, 2));
  console.log('\nNetwork errors:', networkErrors);

  await browser.close();
}

test().catch(console.error);

