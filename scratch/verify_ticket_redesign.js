const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const TICKET_ID = '6aed6b3721b17fc127765f40';
const SESSION_COOKIE = '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f';

const VIEWPORTS = [
  { name: 'mobile-min-320px', width: 320, height: 600 },
  { name: 'mobile-small-360px', width: 360, height: 740 },
  { name: 'mobile-standard-375px', width: 375, height: 812 },
  { name: 'mobile-large-390px', width: 390, height: 844 },
  { name: 'mobile-plus-414px', width: 414, height: 896 },
  { name: 'mobile-max-430px', width: 430, height: 932 },
  { name: 'tablet-768px', width: 768, height: 1024 },
  { name: 'laptop-1024px', width: 1024, height: 768 },
  { name: 'desktop-laptop-1366px', width: 1366, height: 768 },
  { name: 'desktop-wide-1440px', width: 1440, height: 900 }
];

async function runVerification() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const results = {
    ticketId: TICKET_ID,
    timestamp: new Date().toISOString(),
    viewports: [],
    assertions: {},
    qrScanResults: {}
  };

  // Set session cookie
  await page.setCookie({
    name: 'rapira.sid',
    value: SESSION_COOKIE,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false
  });

  console.log('Navigating to ticket details page...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`http://localhost:3000/tickets/${TICKET_ID}`, {
    waitUntil: 'networkidle2'
  });

  // Verify page title and heading
  const pageTitle = await page.title();
  const headingText = await page.$eval('.rapira-confirmed-title', el => el.textContent.trim());
  console.log(`Page Heading: "${headingText}"`);
  results.assertions.pageHeading = headingText;

  // Verify ticket elements
  const ticketBrand = await page.$eval('.rapira-pass-brand', el => el.textContent.trim());
  const concertTitle = await page.$eval('.rapira-pass-concert-title', el => el.textContent.trim());
  const statusPill = await page.$eval('.rapira-pass-status-pill', el => el.textContent.trim());
  const ticketNo = await page.$eval('.rapira-stub-ticket-no', el => el.textContent.trim());
  const qrSrc = await page.$eval('.rapira-qr-img', el => el.src);

  results.assertions.ticketBrand = ticketBrand;
  results.assertions.concertTitle = concertTitle;
  results.assertions.statusPill = statusPill;
  results.assertions.ticketNo = ticketNo;
  results.assertions.qrSrc = qrSrc;

  console.log('Ticket Data:');
  console.log(`- Brand: ${ticketBrand}`);
  console.log(`- Concert Title: ${concertTitle}`);
  console.log(`- Status: ${statusPill}`);
  console.log(`- Ticket Number: ${ticketNo}`);
  console.log(`- QR Code Source: ${qrSrc}`);

  // Test Interactive Actions
  console.log('Testing wallet button interaction...');
  await page.click('.js-rapira-wallet-btn');
  await new Promise(r => setTimeout(r, 400));
  const toastText = await page.$eval('#rapiraTicketToast', el => el.textContent.trim()).catch(() => '');
  results.assertions.walletToast = toastText;
  console.log(`Wallet Toast: "${toastText}"`);

  console.log('Testing receipt drawer toggle...');
  await page.click('#rapiraReceiptToggleBtn');
  await new Promise(r => setTimeout(r, 300));
  const receiptOpen = await page.$eval('#rapiraReceiptContent', el => el.classList.contains('open'));
  results.assertions.receiptDrawerOpens = receiptOpen;
  console.log(`Receipt drawer open: ${receiptOpen}`);

  // Inject jsQR to test QR code scanning on desktop
  console.log('Testing QR scanning via jsQR on Desktop...');
  try {
    await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js' });
    const qrDecoded = await page.evaluate(async () => {
      const img = document.querySelector('.rapira-qr-img');
      if (!img) return { error: 'No QR image element' };

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 200;
      canvas.height = img.naturalHeight || 200;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (typeof jsQR === 'undefined') return { error: 'jsQR library not loaded' };
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      return {
        scannedPayload: code ? code.data : null,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      };
    });
    results.qrScanResults.desktop = qrDecoded;
    console.log('QR Code Scan Desktop:', qrDecoded);
  } catch (err) {
    console.warn('QR scan evaluation note:', err.message);
    results.qrScanResults.desktop = { note: err.message };
  }

  // Capture Desktop Screenshot
  const desktopShotPath = path.join(ARTIFACT_DIR, 'ticket-desktop-1440px.png');
  await page.screenshot({ path: desktopShotPath, fullPage: true });
  console.log(`Saved screenshot: ${desktopShotPath}`);

  // Tablet 768px Screenshot
  await page.setViewport({ width: 768, height: 1024 });
  await new Promise(r => setTimeout(r, 400));
  const tabletShotPath = path.join(ARTIFACT_DIR, 'ticket-tablet-768px.png');
  await page.screenshot({ path: tabletShotPath, fullPage: true });
  console.log(`Saved screenshot: ${tabletShotPath}`);

  // Mobile 375px Screenshot
  await page.setViewport({ width: 375, height: 812 });
  await new Promise(r => setTimeout(r, 400));
  const mobileShotPath = path.join(ARTIFACT_DIR, 'ticket-mobile-375px.png');
  await page.screenshot({ path: mobileShotPath, fullPage: true });
  console.log(`Saved screenshot: ${mobileShotPath}`);

  // Test all 10 responsive viewports for overflow
  console.log('\nTesting 10 viewports for horizontal overflow...');
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 200));

    const metrics = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const clientW = document.documentElement.clientWidth;
      const bodyScrollW = document.body.scrollWidth;
      const maxScroll = Math.max(scrollW, bodyScrollW);
      return {
        scrollWidth: maxScroll,
        clientWidth: clientW,
        overflowPx: Math.max(0, maxScroll - clientW)
      };
    });

    const isPass = metrics.overflowPx === 0;
    console.log(`- ${vp.name.padEnd(24)} (${vp.width}x${vp.height}): Overflow = ${metrics.overflowPx}px -> ${isPass ? 'PASS' : 'FAIL'}`);

    results.viewports.push({
      name: vp.name,
      width: vp.width,
      height: vp.height,
      scrollWidth: metrics.scrollWidth,
      clientWidth: metrics.clientWidth,
      overflowPx: metrics.overflowPx,
      pass: isPass
    });
  }

  // Save results JSON
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'ticket-redesign-verification.json'),
    JSON.stringify(results, null, 2)
  );

  console.log('\nVerification complete! Results written to ticket-redesign-verification.json');
  await browser.close();
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});

