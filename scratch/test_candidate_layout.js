const fs = require('fs');
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  // Inject our candidate mobile CSS to test live before saving
  const candidateCss = `
  @media (max-width: 767.98px) {
    .rapira-homepage .rh-how-card {
      flex: 0 0 85% !important;
      width: 85% !important;
      max-width: 335px !important;
      min-width: 290px !important;
      min-height: 405px !important;
      height: 405px !important;
      scroll-snap-align: start !important;
      scroll-snap-stop: always !important;
      border-radius: 20px !important;
      position: relative !important;
      overflow: hidden !important;
    }
    .rapira-homepage .rh-how-card-inner {
      display: flex !important;
      flex-direction: row !important;
      justify-content: space-between !important;
      align-items: stretch !important;
      width: 100% !important;
      height: 100% !important;
      padding: 1.75rem 1.15rem 1.65rem 1.35rem !important;
      position: relative !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      z-index: 2 !important;
    }
    .rapira-homepage .rh-card-content {
      flex: 1 1 auto !important;
      width: 62% !important;
      max-width: 62% !important;
      min-width: 0 !important;
      height: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: flex-start !important;
      justify-content: flex-start !important;
      position: relative !important;
      z-index: 2 !important;
      padding-right: 0.5rem !important;
    }
    .rapira-homepage .rh-card-number {
      font-size: 2.5rem !important;
      line-height: 1 !important;
      margin: 0 0 0.35rem 0 !important;
    }
    .rapira-homepage .rh-card-badge {
      width: 38px !important;
      height: 38px !important;
      font-size: 1.05rem !important;
      border-radius: 12px !important;
      margin: 0 0 0.65rem 0 !important;
      flex-shrink: 0 !important;
    }
    .rapira-homepage .rh-card-title {
      font-size: clamp(1.4rem, 4.8vw, 1.65rem) !important;
      line-height: 1.1 !important;
      letter-spacing: -0.01em !important;
      margin: 0 0 0.45rem 0 !important;
      word-break: normal !important;
    }
    .rapira-homepage .rh-card-desc {
      font-size: 0.81rem !important;
      line-height: 1.48 !important;
      margin: 0 0 0.85rem 0 !important;
    }
    .rapira-homepage .rh-card-cta-btn {
      width: 38px !important;
      height: 38px !important;
      border-radius: 50% !important;
      font-size: 1rem !important;
      margin-top: auto !important;
      flex-shrink: 0 !important;
    }
    .rapira-homepage .rh-card-art {
      position: relative !important;
      top: auto !important;
      right: auto !important;
      bottom: auto !important;
      left: auto !important;
      flex: 0 0 38% !important;
      width: 38% !important;
      max-width: 38% !important;
      height: 100% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      pointer-events: none !important;
      user-select: none !important;
      z-index: 1 !important;
      overflow: hidden !important;
    }

    /* Card 01 Discover Artwork */
    .rapira-homepage .rh-card-discover .rh-card-art {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      overflow: hidden !important;
    }
    .rapira-homepage .rh-card-discover .rh-card-art picture {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      height: 100% !important;
    }
    .rapira-homepage .rh-card-discover .rh-art-img {
      width: 100% !important;
      max-width: 108px !important;
      height: auto !important;
      aspect-ratio: 1 / 1 !important;
      object-fit: contain !important;
      position: static !important;
      transform: none !important;
      border-radius: 50% !important;
      filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.10)) !important;
    }

    /* Card 02 Connect Artwork */
    .rapira-homepage .rh-card-connect .rh-card-art {
      display: flex !important;
      align-items: flex-end !important;
      justify-content: center !important;
      overflow: hidden !important;
      border-radius: 0 20px 20px 0 !important;
    }
    .rapira-homepage .rh-card-connect .rh-card-art picture {
      width: 100% !important;
      height: 100% !important;
      display: block !important;
    }
    .rapira-homepage .rh-card-connect .rh-art-img {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      object-position: center bottom !important;
      position: static !important;
      transform: none !important;
    }

    /* Card 03 Experience Artwork */
    .rapira-homepage .rh-card-experience .rh-card-art {
      display: flex !important;
      align-items: flex-end !important;
      justify-content: center !important;
      overflow: hidden !important;
      border-radius: 0 20px 20px 0 !important;
    }
    .rapira-homepage .rh-card-experience .rh-card-art picture {
      width: 100% !important;
      height: 100% !important;
      display: flex !important;
      align-items: flex-end !important;
      justify-content: center !important;
    }
    .rapira-homepage .rh-card-experience .rh-art-img {
      width: 100% !important;
      max-width: 108px !important;
      height: 90% !important;
      object-fit: contain !important;
      object-position: center bottom !important;
      position: static !important;
      transform: none !important;
    }
  }
  `;

  await page.addStyleTag({ content: candidateCss });
  await new Promise(r => setTimeout(r, 400));

  // Check collision/overlap between text bounding box and artwork bounding box for all 3 cards
  const overlapCheck = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.rh-how-card'));
    return cards.map((c, i) => {
      const content = c.querySelector('.rh-card-content');
      const title = c.querySelector('.rh-card-title');
      const desc = c.querySelector('.rh-card-desc');
      const art = c.querySelector('.rh-card-art');
      const img = c.querySelector('.rh-art-img');

      const contentRect = content.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const descRect = desc.getBoundingClientRect();
      const artRect = art.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();

      // Check horizontal collision: does art or img left edge overlap content/title/desc right edge?
      const titleOverlap = titleRect.right > imgRect.left;
      const descOverlap = descRect.right > imgRect.left;
      const contentOverlap = contentRect.right > artRect.left;

      return {
        cardIndex: i,
        title: title.innerText,
        contentWidth: Math.round(contentRect.width),
        titleWidth: Math.round(titleRect.width),
        descWidth: Math.round(descRect.width),
        artWidth: Math.round(artRect.width),
        imgWidth: Math.round(imgRect.width),
        gapBetweenContentAndArt: Math.round(artRect.left - contentRect.right),
        gapBetweenTitleAndImg: Math.round(imgRect.left - titleRect.right),
        titleOverlap,
        descOverlap,
        contentOverlap
      };
    });
  });

  console.log('Overlap Check (375px):', JSON.stringify(overlapCheck, null, 2));

  // Capture test screenshots of all 3 cards
  const track = await page.$('.rh-how-cards-track');
  const cards = await page.$$('.rh-how-card');

  for (let i = 0; i < cards.length; i++) {
    // Scroll card into view
    await page.evaluate((idx) => {
      const c = document.querySelectorAll('.rh-how-card')[idx];
      c.scrollIntoView({ behavior: 'instant', inline: 'start' });
    }, i);
    await new Promise(r => setTimeout(r, 300));

    const box = await cards[i].boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(__dirname, `test_card_${i + 1}.png`),
        clip: {
          x: Math.max(0, box.x - 5),
          y: Math.max(0, box.y - 5),
          width: Math.min(box.width + 10, 375),
          height: box.height + 10
        }
      });
      console.log(`Saved test_card_${i + 1}.png`);
    }
  }

  await browser.close();
})();

