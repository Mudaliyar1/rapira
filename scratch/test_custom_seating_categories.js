const mongoose = require('mongoose');
require('dotenv').config();
const Concert = require('../models/Concert');
const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const CONCERT_ID = '6aec50df716ae22e5aa1797f';
const SESSION_COOKIE = '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f';

async function testCustomCategories() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[TEST MULTI-CATEGORY] Connected to MongoDB');

  // Backup original concert data
  const originalConcert = await Concert.findById(CONCERT_ID).lean();

  try {
    // Configure 2 custom categories: VIP Gold (₹50.00) & Silver Tier (₹20.00)
    console.log('[TEST MULTI-CATEGORY] Updating concert with custom seatingCategories...');
    await Concert.findByIdAndUpdate(CONCERT_ID, {
      seatingCategories: [
        {
          name: 'VIP Gold',
          price: 50,
          description: 'Front row seats with exclusive stage acoustics',
          rows: ['A', 'B'],
          seatsPerRow: 10,
          soldSeats: ['A-01', 'A-02'],
          bestsellerSeats: ['B-05']
        },
        {
          name: 'Silver Tier',
          price: 20,
          description: 'Standard comfortable seats with panoramic view',
          rows: ['C', 'D'],
          seatsPerRow: 12,
          soldSeats: ['C-01'],
          bestsellerSeats: ['D-06']
        }
      ]
    });

    console.log('[TEST MULTI-CATEGORY] Launching Puppeteer to test multi-category rendering...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setCookie({
      name: 'rapira.sid',
      value: SESSION_COOKIE,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false
    });

    await page.setViewport({ width: 1440, height: 900 });
    // Go directly to seats step
    await page.goto(`http://localhost:3000/concerts/${CONCERT_ID}/select-quantity?step=seats&quantity=2`, {
      waitUntil: 'networkidle2'
    });

    // Verify rendered categories
    const categoryHeaders = await page.$$eval('.rapira-category-header', headers => 
      headers.map(h => h.textContent.trim())
    );
    console.log('[TEST MULTI-CATEGORY] Rendered Categories:', categoryHeaders);

    // Verify Total Amount for 2 seats in VIP Gold (₹50 * 2 = ₹100 + 1% = ₹101.00)
    const totalAmount = await page.$eval('#summaryTotalAmount', el => el.textContent.trim());
    console.log('[TEST MULTI-CATEGORY] Total for 2 VIP Gold seats:', totalAmount);

    // Capture screenshot of custom multi-category seating
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'booking-multi-category-test.png'),
      fullPage: false
    });
    console.log('[TEST MULTI-CATEGORY] Saved: booking-multi-category-test.png');

    await browser.close();
  } finally {
    // Restore original concert state (no hardcoded custom categories)
    console.log('[TEST MULTI-CATEGORY] Restoring original concert state...');
    await Concert.findByIdAndUpdate(CONCERT_ID, {
      $unset: { seatingCategories: 1 }
    });
    await mongoose.disconnect();
    console.log('[TEST MULTI-CATEGORY] Cleanup complete!');
  }
}

testCustomCategories().catch(err => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
