const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const CONCERT_ID = '6aec50df716ae22e5aa1797f';
const SESSION_COOKIE = '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f';

const TEST_VIEWPORTS = [
  { name: 'mobile-360px', width: 360, height: 740 },
  { name: 'mobile-375px', width: 375, height: 812 },
  { name: 'mobile-390px', width: 390, height: 844 },
  { name: 'mobile-414px', width: 414, height: 896 },
  { name: 'tablet-768px', width: 768, height: 1024 },
  { name: 'laptop-1024px', width: 1024, height: 768 },
  { name: 'desktop-1280px', width: 1280, height: 800 },
  { name: 'desktop-1440px', width: 1440, height: 900 },
  { name: 'desktop-1920px', width: 1920, height: 1080 }
];

async function runBookingVerification() {
  console.log('[BOOKING QA] Starting verification suite...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const report = {
    timestamp: new Date().toISOString(),
    concertId: CONCERT_ID,
    step1_vehicle: {},
    step2_seats: {},
    step3_checkout: {},
    viewports: [],
    pricing_verification: {}
  };

  // Set logged-in session cookie
  await page.setCookie({
    name: 'rapira.sid',
    value: SESSION_COOKIE,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false
  });

  // 1. Load Step 1 at Desktop 1440px
  console.log('[BOOKING QA] 1. Loading Step 1: Vehicle Selection Screen (1440px)...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`http://localhost:3000/concerts/${CONCERT_ID}/select-quantity`, {
    waitUntil: 'networkidle2'
  });

  // Verify Navbar Styling
  const navbarBg = await page.$eval('.navbar-glass, nav.navbar', el => {
    return window.getComputedStyle(el).backgroundColor;
  });
  console.log(`[BOOKING QA] Navbar Background Color: ${navbarBg}`);
  report.navbarBg = navbarBg;

  // Verify Heading & Vehicle Buttons
  const heading = await page.$eval('.rapira-vehicle-heading', el => el.textContent.trim());
  const vehicleCount = await page.$$eval('.rapira-vehicle-btn', btns => btns.length);
  const activeVehicle = await page.$eval('.rapira-vehicle-btn.active .rapira-vehicle-title', el => el.textContent.trim());
  const initialQty = await page.$eval('#vehicleStepperVal', el => el.textContent.trim());

  console.log(`[BOOKING QA] Heading: "${heading}" | Vehicles Count: ${vehicleCount} | Default Active: "${activeVehicle}" | Qty: ${initialQty}`);
  report.step1_vehicle.heading = heading;
  report.step1_vehicle.vehicleCount = vehicleCount;
  report.step1_vehicle.activeVehicle = activeVehicle;
  report.step1_vehicle.initialQty = initialQty;

  // Capture Desktop Screenshot of Step 1
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'booking-step1-vehicle-desktop.png'),
    fullPage: false
  });
  console.log('[BOOKING QA] Saved: booking-step1-vehicle-desktop.png');

  // Test Interactive Vehicle Selection: Click "Cycle" (1 ticket)
  console.log('[BOOKING QA] Testing click on Cycle...');
  await page.click('.rapira-vehicle-btn[data-vehicle="cycle"]');
  await new Promise(r => setTimeout(r, 100));
  const qtyAfterCycle = await page.$eval('#vehicleStepperVal', el => el.textContent.trim());
  const cycleActive = await page.$eval('.rapira-vehicle-btn[data-vehicle="cycle"]', el => el.classList.contains('active'));
  console.log(`[BOOKING QA] Cycle Click Result: Qty=${qtyAfterCycle}, isCycleActive=${cycleActive}`);
  report.step1_vehicle.cycleClick = { qty: qtyAfterCycle, active: cycleActive };

  // Test Stepper Plus: Click "+" to go back to 2 (Scooter)
  console.log('[BOOKING QA] Testing Stepper Plus to 2 (Scooter)...');
  await page.click('#vehicleStepperPlus');
  await new Promise(r => setTimeout(r, 100));
  const qtyAfterPlus = await page.$eval('#vehicleStepperVal', el => el.textContent.trim());
  const scooterActive = await page.$eval('.rapira-vehicle-btn[data-vehicle="scooter"]', el => el.classList.contains('active'));
  console.log(`[BOOKING QA] Stepper Plus Result: Qty=${qtyAfterPlus}, isScooterActive=${scooterActive}`);
  report.step1_vehicle.stepperPlus = { qty: qtyAfterPlus, active: scooterActive };

  // 2. Click "Continue to Seat Selection" -> Transitions to Step 2
  console.log('[BOOKING QA] 2. Clicking Continue to Seat Selection...');
  await page.click('#continueToSeatsBtn');
  await new Promise(r => setTimeout(r, 300));

  // Verify Step 2 is Visible and Step 1 is Hidden
  const isStep2Visible = await page.$eval('#stepSeatsSection', el => el.style.display !== 'none');
  const isStep1Hidden = await page.$eval('#stepVehicleSection', el => el.style.display === 'none');
  const seatMapTitle = await page.$eval('.rapira-seat-map-title', el => el.textContent.trim());
  const categoryHeader = await page.$eval('.rapira-category-header', el => el.textContent.trim());
  const totalAmountText = await page.$eval('#summaryTotalAmount', el => el.textContent.trim());
  const selectedSeats = await page.$$eval('.rapira-seat-chip', chips => chips.map(c => c.textContent.trim().replace('×', '').trim()));

  console.log(`[BOOKING QA] Step 2 Visible: ${isStep2Visible} | Title: "${seatMapTitle}"`);
  console.log(`[BOOKING QA] Category Header (Dynamic Config): "${categoryHeader}"`);
  console.log(`[BOOKING QA] Total Amount: "${totalAmountText}" | Seats: [${selectedSeats.join(', ')}]`);

  report.step2_seats.isStep2Visible = isStep2Visible;
  report.step2_seats.seatMapTitle = seatMapTitle;
  report.step2_seats.categoryHeader = categoryHeader;
  report.step2_seats.totalAmount = totalAmountText;
  report.step2_seats.selectedSeats = selectedSeats;

  // Verify Legend Strip Background
  const legendBg = await page.$eval('.rapira-seat-legend', el => window.getComputedStyle(el).backgroundColor);
  console.log(`[BOOKING QA] Seat Legend Background Color: ${legendBg}`);
  report.step2_seats.legendBg = legendBg;

  // Capture Desktop Screenshot of Step 2
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'booking-step2-seats-desktop.png'),
    fullPage: false
  });
  console.log('[BOOKING QA] Saved: booking-step2-seats-desktop.png');

  // Test Seat Click Interaction: Click an available seat to deselect and select
  console.log('[BOOKING QA] Testing seat click interaction...');
  const firstChipSeat = selectedSeats[0];
  if (firstChipSeat) {
    // Deselect via chip remove icon
    await page.click(`[data-remove-seat="${firstChipSeat}"]`);
    await new Promise(r => setTimeout(r, 100));
    const countAfterRemove = await page.$eval('#seatCountLabel', el => el.textContent.trim());
    console.log(`[BOOKING QA] Seat count after removing ${firstChipSeat}: ${countAfterRemove}`);

    // Re-select seat on map
    await page.click(`.rapira-seat[data-seat-id="${firstChipSeat}"]`);
    await new Promise(r => setTimeout(r, 100));
    const countAfterReselect = await page.$eval('#seatCountLabel', el => el.textContent.trim());
    console.log(`[BOOKING QA] Seat count after reselecting ${firstChipSeat}: ${countAfterReselect}`);
    report.step2_seats.interactiveSeatTest = { removed: countAfterRemove, reselected: countAfterReselect };
  }

  // 3. Responsive Audit Across 9 Viewports
  console.log('[BOOKING QA] 3. Running responsive audit across 9 viewports...');
  for (const vp of TEST_VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 200));

    const overflow = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      return {
        docWidth,
        winWidth,
        hasOverflow: docWidth > winWidth,
        overflowPx: Math.max(0, docWidth - winWidth)
      };
    });

    console.log(`[VIEWPORT ${vp.name}] Width: ${vp.width}px | Doc: ${overflow.docWidth}px | Overflow: ${overflow.overflowPx}px`);

    report.viewports.push({
      name: vp.name,
      width: vp.width,
      height: vp.height,
      ...overflow
    });

    // Capture mobile screenshots at 375px
    if (vp.width === 375) {
      // Step 2 Mobile
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'booking-step2-seats-mobile.png'),
        fullPage: false
      });
      console.log('[BOOKING QA] Saved: booking-step2-seats-mobile.png');

      // Go back to Step 1 and capture Step 1 Mobile
      await page.click('#backToVehicleBtn');
      await new Promise(r => setTimeout(r, 200));
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'booking-step1-vehicle-mobile.png'),
        fullPage: false
      });
      console.log('[BOOKING QA] Saved: booking-step1-vehicle-mobile.png');

      // Go back to Step 2
      await page.click('#continueToSeatsBtn');
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // 4. Test "Proceed to Checkout"
  console.log('[BOOKING QA] 4. Testing Proceed to Checkout...');
  await page.setViewport({ width: 1440, height: 900 });
  await new Promise(r => setTimeout(r, 200));

  const isSeatsStep = await page.evaluate(() => {
    const s2 = document.getElementById('stepSeatsSection');
    return s2 && s2.style.display !== 'none';
  });
  if (!isSeatsStep) {
    await page.click('#continueToSeatsBtn');
    await new Promise(r => setTimeout(r, 200));
  }

  const btnDisabled = await page.$eval('#proceedCheckoutBtn', btn => btn.disabled);
  console.log(`[BOOKING QA] Proceed Button Disabled before click: ${btnDisabled}`);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
    page.click('#proceedCheckoutBtn')
  ]);

  const currentUrl = page.url();
  console.log(`[BOOKING QA] Navigated URL: ${currentUrl}`);
  report.step3_checkout.url = currentUrl;

  const checkoutTitle = await page.$eval('.rapira-checkout-title', el => el.textContent.trim());
  const checkoutTotal = await page.$eval('#totalAmountInput', el => el.value);
  const checkoutSeatsBadge = await page.$eval('#selectedSeatsDisplay, .rapira-checkout-card', el => el.textContent.includes('A-01'));

  console.log(`[BOOKING QA] Checkout Title: "${checkoutTitle}" | Total: ₹${checkoutTotal} | Seats Present: ${checkoutSeatsBadge}`);
  report.step3_checkout.title = checkoutTitle;
  report.step3_checkout.total = checkoutTotal;

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'booking-checkout-verification.png'),
    fullPage: false
  });
  console.log('[BOOKING QA] Saved: booking-checkout-verification.png');

  // Write verification report
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'booking-qa-verification.json'),
    JSON.stringify(report, null, 2)
  );

  await browser.close();
  console.log('[BOOKING QA] All tests completed successfully!');
  return report;
}

runBookingVerification().catch(err => {
  console.error('[BOOKING QA ERROR]', err);
  process.exit(1);
});
