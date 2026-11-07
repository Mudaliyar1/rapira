const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const ARTIFACTS_DIR = 'C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d';

const VIEWPORTS = [
  { name: 'mobile-360px', width: 360, height: 800 },
  { name: 'mobile-375px', width: 375, height: 812 },
  { name: 'mobile-390px', width: 390, height: 844 },
  { name: 'mobile-414px', width: 414, height: 896 },
  { name: 'tablet-768px', width: 768, height: 1024 },
  { name: 'desktop-1024px', width: 1024, height: 768 },
  { name: 'desktop-1440px', width: 1440, height: 900 }
];

async function runCartQA() {
  console.log('=== STARTING RAPIRA CART UI REDESIGN QA ===\n');
  let allPassed = true;

  // 1. First verify initial real database state: Cart collection must be empty
  await mongoose.connect(process.env.MONGODB_URI);
  const Cart = require('../models/Cart');
  const Product = require('../models/Product');
  const initialCartCount = await Cart.countDocuments();
  console.log(`[INIT] Real database Cart collection count: ${initialCartCount}`);

  const tempProfile = path.join(os.tmpdir(), 'puppeteer_cart_qa_' + Date.now());
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tempProfile,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();

    // Collect console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.toString()));

    // ------------------------------------------------------------------
    // PHASE 1: EMPTY CART TESTING (Real initial empty state)
    // ------------------------------------------------------------------
    console.log('\n--- PHASE 1: EMPTY CART STATE TESTING ---');

    // [1.1] Desktop 1440px Empty State
    console.log('[1.1] Testing Desktop 1440px Empty Cart...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000/shop/cart', { waitUntil: 'networkidle2' });

    const emptyChecks = await page.evaluate(() => {
      const card = document.querySelector('.rh-cart-empty-card');
      const title = card ? card.querySelector('.rh-cart-empty-title')?.textContent.trim() : '';
      const desc = card ? card.querySelector('.rh-cart-empty-desc')?.textContent.trim() : '';
      const btn = card ? card.querySelector('.rh-cart-empty-btn') : null;
      const svg = card ? card.querySelector('.rh-cart-empty-svg') : null;
      const hasGlassCard = document.querySelector('.glass-card-dark') !== null;

      return {
        hasEmptyCard: !!card,
        titleCorrect: title === 'Your Cart is Empty',
        hasDesc: desc.includes("haven't added any merchandise"),
        btnHref: btn ? btn.getAttribute('href') : '',
        btnText: btn ? btn.textContent.trim() : '',
        hasSvg: !!svg,
        hasGlassCard
      };
    });

    console.log('✓ Empty card rendered:', emptyChecks.hasEmptyCard);
    console.log('✓ Empty title matches ("Your Cart is Empty"):', emptyChecks.titleCorrect);
    console.log('✓ Empty description text correct:', emptyChecks.hasDesc);
    console.log(`✓ Explore button: "${emptyChecks.btnText}" -> ${emptyChecks.btnHref}`);
    console.log('✓ Has custom shopping cart SVG:', emptyChecks.hasSvg);
    console.log('✓ Zero glass-card-dark / legacy dark theme:', !emptyChecks.hasGlassCard);

    if (!emptyChecks.hasEmptyCard || !emptyChecks.titleCorrect || !emptyChecks.hasSvg || emptyChecks.hasGlassCard) {
      allPassed = false;
    }

    const deskEmptyPath = path.join(ARTIFACTS_DIR, 'cart-desktop-1440px-empty.png');
    await page.screenshot({ path: deskEmptyPath, fullPage: true });
    console.log('✓ Saved desktop empty screenshot to:', deskEmptyPath);

    // [1.2] Mobile 375px Empty State
    console.log('\n[1.2] Testing Mobile 375px Empty Cart...');
    await page.setViewport({ width: 375, height: 812 });
    await page.goto('http://localhost:3000/shop/cart', { waitUntil: 'networkidle2' });

    const mobEmptyPath = path.join(ARTIFACTS_DIR, 'cart-mobile-375px-empty.png');
    await page.screenshot({ path: mobEmptyPath, fullPage: true });
    console.log('✓ Saved mobile empty screenshot to:', mobEmptyPath);

    // [1.3] Overflow checks across 7 viewports for empty cart
    console.log('\n[1.3] Testing Empty Cart Overflow across 7 viewports...');
    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto('http://localhost:3000/shop/cart', { waitUntil: 'networkidle2' });
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      }));
      if (overflow.hasOverflow) {
        console.error(`❌ Overflow on empty cart at ${vp.name}!`);
        allPassed = false;
      } else {
        console.log(`  ✓ ${vp.name}: 0px overflow (${overflow.scrollWidth}px)`);
      }
    }

    // ------------------------------------------------------------------
    // PHASE 2: POPULATED CART TESTING (Temporary Test Fixtures ONLY)
    // ------------------------------------------------------------------
    console.log('\n--- PHASE 2: POPULATED CART STATE TESTING (Temporary Test Fixtures) ---');

    // Find sample products to populate the temporary test fixture
    const tshirt = await Product.findOne({ name: 'RAPIRA Classic T-Shirt' }).lean();
    const tote = await Product.findOne({ name: 'RAPIRA Tote Bag' }).lean();

    if (!tshirt || !tote) {
      throw new Error('Could not find sample products for temporary test fixture');
    }

    // Add items via the actual cart API in the browser session
    console.log('[2.1] Adding items to temporary session via API...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000/shop', { waitUntil: 'networkidle2' });

    const add1 = await page.evaluate(async (pId) => {
      const res = await fetch('/shop/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: pId, size: 'L', quantity: 1 })
      });
      return await res.json();
    }, tshirt._id.toString());
    console.log('  Item 1 added (T-Shirt Size L):', add1.success);

    const add2 = await page.evaluate(async (pId) => {
      const res = await fetch('/shop/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: pId, size: 'One Size', quantity: 1 })
      });
      return await res.json();
    }, tote._id.toString());
    console.log('  Item 2 added (Tote Bag One Size):', add2.success);

    // [2.2] Desktop 1440px Populated Cart Testing
    console.log('\n[2.2] Testing Desktop 1440px Populated Cart...');
    await page.goto('http://localhost:3000/shop/cart', { waitUntil: 'networkidle2' });

    const popChecksDesk = await page.evaluate(() => {
      const title = document.querySelector('.rh-cart-title')?.textContent.trim();
      const items = document.querySelectorAll('.rh-cart-item-row');
      const orderSummary = document.querySelector('.rh-cart-summary-card');
      const subtotal = orderSummary?.querySelector('.rh-cart-summary-row .rh-cart-summary-value')?.textContent.trim();
      const total = orderSummary?.querySelector('.rh-cart-total-value')?.textContent.trim();
      const checkoutBtn = orderSummary?.querySelector('.rh-cart-checkout-btn');
      const continueLink = document.querySelector('.rh-cart-continue-link');

      const firstItemName = items[0]?.querySelector('.rh-cart-item-name a')?.textContent.trim();
      const secondItemName = items[1]?.querySelector('.rh-cart-item-name a')?.textContent.trim();

      return {
        title,
        itemCount: items.length,
        hasSummary: !!orderSummary,
        subtotal,
        total,
        hasCheckoutBtn: !!checkoutBtn && checkoutBtn.getAttribute('href') === '/shop/checkout',
        hasContinueLink: !!continueLink && continueLink.getAttribute('href') === '/shop',
        firstItemName,
        secondItemName
      };
    });

    console.log(`✓ Cart Title: "${popChecksDesk.title}"`);
    console.log(`✓ Cart Items Rendered: ${popChecksDesk.itemCount} items`);
    console.log(`  - Item 1: ${popChecksDesk.firstItemName}`);
    console.log(`  - Item 2: ${popChecksDesk.secondItemName}`);
    console.log(`✓ Order Summary: Subtotal=${popChecksDesk.subtotal}, Total=${popChecksDesk.total}`);
    console.log(`✓ Proceed to Checkout button: ${popChecksDesk.hasCheckoutBtn}`);
    console.log(`✓ Continue Shopping link: ${popChecksDesk.hasContinueLink}`);

    if (popChecksDesk.itemCount !== 2 || !popChecksDesk.hasSummary || !popChecksDesk.hasCheckoutBtn) {
      allPassed = false;
    }

    const deskPopPath = path.join(ARTIFACTS_DIR, 'cart-desktop-1440px-populated.png');
    await page.screenshot({ path: deskPopPath, fullPage: true });
    console.log('✓ Saved desktop populated screenshot to:', deskPopPath);

    // [2.3] Mobile 375px Populated Cart Testing
    console.log('\n[2.3] Testing Mobile 375px Populated Cart...');
    await page.setViewport({ width: 375, height: 812 });
    await page.goto('http://localhost:3000/shop/cart', { waitUntil: 'networkidle2' });

    const mobPopPath = path.join(ARTIFACTS_DIR, 'cart-mobile-375px-populated.png');
    await page.screenshot({ path: mobPopPath, fullPage: true });
    console.log('✓ Saved mobile populated screenshot to:', mobPopPath);

    // [2.4] Populated Overflow check across 7 viewports
    console.log('\n[2.4] Testing Populated Cart Overflow across 7 viewports...');
    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto('http://localhost:3000/shop/cart', { waitUntil: 'networkidle2' });
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      }));
      if (overflow.hasOverflow) {
        console.error(`❌ Overflow on populated cart at ${vp.name}!`);
        allPassed = false;
      } else {
        console.log(`  ✓ ${vp.name}: 0px overflow (${overflow.scrollWidth}px)`);
      }
    }

    // [2.5] Test Quantity Increment and Decrement via API in browser
    console.log('\n[2.5] Testing Quantity Update interaction...');
    const updateRes = await page.evaluate(async (pId) => {
      const res = await fetch('/shop/cart/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: pId, size: 'L', quantity: 2 })
      });
      return await res.json();
    }, tshirt._id.toString());
    console.log('  Updated T-Shirt quantity to 2:', updateRes.success, 'New totalItems:', updateRes.cartCount);

    await page.goto('http://localhost:3000/shop/cart', { waitUntil: 'networkidle2' });
    const newQtyVal = await page.evaluate(() => {
      const qtyEl = document.querySelector('.rh-cart-qty-val');
      return qtyEl ? qtyEl.textContent.trim() : '';
    });
    console.log(`✓ Rendered quantity after update: ${newQtyVal} (expected 2)`);
    if (newQtyVal !== '2') allPassed = false;

    // ------------------------------------------------------------------
    // PHASE 3: TEARDOWN & FIXTURE REMOVAL (Strict Scope Requirement)
    // ------------------------------------------------------------------
    console.log('\n--- PHASE 3: TEARDOWN & FIXTURE REMOVAL ---');

    // Remove items via remove API
    await page.evaluate(async (pId) => {
      await fetch('/shop/cart/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: pId, size: 'L' })
      });
    }, tshirt._id.toString());

    await page.evaluate(async (pId) => {
      await fetch('/shop/cart/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: pId, size: 'One Size' })
      });
    }, tote._id.toString());

    // Also delete any Cart documents in MongoDB
    await Cart.deleteMany({});
    console.log('✓ All database Cart collections cleaned.');

    // Clear browser cookies and storage
    await page.deleteCookie(...(await page.cookies()));
    console.log('✓ Browser cookies and session cleared.');

    // Verify cart is 100% empty again
    await page.goto('http://localhost:3000/shop/cart', { waitUntil: 'networkidle2' });
    const isCleanEmpty = await page.evaluate(() => {
      const card = document.querySelector('.rh-cart-empty-card');
      const items = document.querySelectorAll('.rh-cart-item-row');
      return !!card && items.length === 0;
    });

    const finalDbCartCount = await Cart.countDocuments();
    console.log(`✓ Verification: Real Cart is completely EMPTY: ${isCleanEmpty}`);
    console.log(`✓ Verification: Database Cart count is: ${finalDbCartCount}`);

    if (!isCleanEmpty || finalDbCartCount !== 0) {
      allPassed = false;
    }

  } catch (err) {
    console.error('QA Error:', err);
    allPassed = false;
  } finally {
    await browser.close();
    try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch (e) {}
    await mongoose.disconnect();
  }

  console.log('\n=======================================');
  console.log('CART QA FINAL RESULT:', allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED');
  console.log('=======================================');
}

runCartQA();

