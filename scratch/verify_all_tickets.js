const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const TICKET_SINGLE_ID = '6aed6b3721b17fc127765f40';
const TICKET_MULTI_ID = '6aed82a3e9bbf8346f8cd850';
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

async function verifyTickets() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const reportData = {
    timestamp: new Date().toISOString(),
    singleTicket: {},
    multiTicket: {},
    viewports: []
  };

  await page.setCookie({
    name: 'rapira.sid',
    value: SESSION_COOKIE,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false
  });

  // -------------------------------------------------------------
  // TEST 1: SINGLE TICKET (Exact reference match)
  // -------------------------------------------------------------
  console.log(`\n=== Testing Single Attendee Ticket (${TICKET_SINGLE_ID}) ===`);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`http://localhost:3000/tickets/${TICKET_SINGLE_ID}`, { waitUntil: 'networkidle2' });

  // Read data
  const sTitle = await page.$eval('.rapira-pass-concert-title', el => el.textContent.trim());
  const sBrand = await page.$eval('.rapira-pass-brand', el => el.textContent.trim());
  const sStatus = await page.$eval('.rapira-pass-status-pill', el => el.textContent.trim());
  const sTicketNo = await page.$eval('.rapira-stub-ticket-no', el => el.textContent.trim());
  const sQrSrc = await page.$eval('.rapira-qr-img', el => el.src);

  reportData.singleTicket = {
    id: TICKET_SINGLE_ID,
    concertTitle: sTitle,
    brand: sBrand,
    status: sStatus,
    ticketNumber: sTicketNo,
    qrSource: sQrSrc
  };

  console.log('Single Ticket Details:');
  console.log(`- Title: ${sTitle}`);
  console.log(`- Brand: ${sBrand}`);
  console.log(`- Status: ${sStatus}`);
  console.log(`- Ticket Number: ${sTicketNo}`);
  console.log(`- QR Source: ${sQrSrc}`);

  // Capture Clean Screenshots
  const shotDesktop = path.join(ARTIFACT_DIR, 'ticket-desktop-1440px.png');
  await page.screenshot({ path: shotDesktop, fullPage: true });
  console.log(`Saved screenshot: ${shotDesktop}`);

  await page.setViewport({ width: 768, height: 1024 });
  await new Promise(r => setTimeout(r, 300));
  const shotTablet = path.join(ARTIFACT_DIR, 'ticket-tablet-768px.png');
  await page.screenshot({ path: shotTablet, fullPage: true });
  console.log(`Saved screenshot: ${shotTablet}`);

  await page.setViewport({ width: 375, height: 812 });
  await new Promise(r => setTimeout(r, 300));
  const shotMobile = path.join(ARTIFACT_DIR, 'ticket-mobile-375px.png');
  await page.screenshot({ path: shotMobile, fullPage: true });
  console.log(`Saved screenshot: ${shotMobile}`);

  // Test QR scanning via jsQR
  console.log('Testing QR scanning via jsQR on desktop...');
  await page.setViewport({ width: 1440, height: 900 });
  await new Promise(r => setTimeout(r, 200));
  await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js' });
  const qrDecoded = await page.evaluate(async () => {
    const img = document.querySelector('.rapira-qr-img');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 200;
    canvas.height = img.naturalHeight || 200;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    return code ? code.data : null;
  });
  reportData.singleTicket.decodedQrPayload = qrDecoded;
  console.log(`QR Decoded Payload: "${qrDecoded}" (matches ticket ID: ${qrDecoded === TICKET_SINGLE_ID})`);

  // Test Wallet and Toast interaction
  await page.click('.js-rapira-wallet-btn');
  await new Promise(r => setTimeout(r, 300));
  const toastText = await page.$eval('#rapiraTicketToast', el => el.textContent.trim()).catch(() => '');
  reportData.singleTicket.walletToast = toastText;
  console.log(`Wallet Toast text: "${toastText}"`);

  // -------------------------------------------------------------
  // TEST 2: MULTI-ATTENDEE TICKET (3 Attendees)
  // -------------------------------------------------------------
  console.log(`\n=== Testing Multi-Attendee Ticket (${TICKET_MULTI_ID}) ===`);
  await page.goto(`http://localhost:3000/tickets/${TICKET_MULTI_ID}`, { waitUntil: 'networkidle2' });
  await page.setViewport({ width: 1440, height: 900 });

  const mTitle = await page.$eval('.rapira-pass-concert-title', el => el.textContent.trim());
  const mTicketNo = await page.$eval('.rapira-stub-ticket-no', el => el.textContent.trim());
  const mAttendeesCount = await page.$$eval('.rapira-attendee-chip', els => els.length);

  reportData.multiTicket = {
    id: TICKET_MULTI_ID,
    concertTitle: mTitle,
    ticketNumber: mTicketNo,
    attendeesCount: mAttendeesCount
  };

  console.log('Multi-Attendee Ticket Details:');
  console.log(`- Title: ${mTitle}`);
  console.log(`- Ticket Number: ${mTicketNo}`);
  console.log(`- Rendered Attendees count: ${mAttendeesCount}`);

  // Capture Multi-Attendee Screenshots
  const shotDesktopMulti = path.join(ARTIFACT_DIR, 'ticket-desktop-1440px-multi.png');
  await page.screenshot({ path: shotDesktopMulti, fullPage: true });
  console.log(`Saved screenshot: ${shotDesktopMulti}`);

  await page.setViewport({ width: 375, height: 812 });
  await new Promise(r => setTimeout(r, 300));
  const shotMobileMulti = path.join(ARTIFACT_DIR, 'ticket-mobile-375px-multi.png');
  await page.screenshot({ path: shotMobileMulti, fullPage: true });
  console.log(`Saved screenshot: ${shotMobileMulti}`);

  // -------------------------------------------------------------
  // TEST 3: 10 VIEWPORTS RESPONSIVE VERIFICATION
  // -------------------------------------------------------------
  console.log('\n=== Testing 10 Viewports for 0px Overflow ===');
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

    reportData.viewports.push({
      name: vp.name,
      width: vp.width,
      height: vp.height,
      scrollWidth: metrics.scrollWidth,
      clientWidth: metrics.clientWidth,
      overflowPx: metrics.overflowPx,
      pass: isPass
    });
  }

  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'ticket-redesign-verification.json'),
    JSON.stringify(reportData, null, 2)
  );
  console.log('\nVerification complete! Results written to ticket-redesign-verification.json');

  await browser.close();
}

verifyTickets().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});

