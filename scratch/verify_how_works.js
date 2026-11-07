const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const artifactDir = 'C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d';
const viewports = [360, 375, 390, 414, 768, 1024, 1440];

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const audit = {};

  for (const width of viewports) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 950, deviceScaleFactor: 2 });

    const failedRequests = [];
    page.on('requestfailed', req => {
      failedRequests.push({ url: req.url(), error: req.failure()?.errorText });
    });

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const data = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const hasHorizontalOverflow = doc.scrollWidth > window.innerWidth || body.scrollWidth > window.innerWidth;

      const section = document.querySelector('.rh-how-works-section');
      const sRect = section ? section.getBoundingClientRect() : null;

      const kicker = document.querySelector('.rh-how-kicker');
      const headline = document.querySelector('.rh-how-headline');
      const subtitle = document.querySelector('.rh-how-subtitle');

      const cards = Array.from(document.querySelectorAll('.rh-how-card')).map(card => {
        const b = card.getBoundingClientRect();
        const title = card.querySelector('.rh-card-title')?.innerText?.trim();
        const desc = card.querySelector('.rh-card-desc')?.innerText?.trim();
        const num = card.querySelector('.rh-card-number')?.innerText?.trim();
        const img = card.querySelector('.rh-art-img');
        const btn = card.querySelector('.rh-card-cta-btn');
        return {
          number: num,
          title,
          desc,
          href: btn ? btn.getAttribute('href') : null,
          imgLoaded: img ? (img.complete && img.naturalWidth > 0) : false,
          imgSrc: img ? img.getAttribute('src') : null,
          rect: {
            top: Math.round(b.top),
            bottom: Math.round(b.bottom),
            left: Math.round(b.left),
            right: Math.round(b.right),
            width: Math.round(b.width),
            height: Math.round(b.height)
          }
        };
      });

      return {
        viewportWidth: window.innerWidth,
        hasHorizontalOverflow,
        scrollWidth: doc.scrollWidth,
        sectionVisible: !!section && (sRect.height > 0),
        kickerText: kicker ? kicker.innerText.trim() : null,
        headlineText: headline ? headline.innerText.trim() : null,
        subtitleText: subtitle ? subtitle.innerText.trim() : null,
        cards
      };
    });

    data.failedRequests = failedRequests;
    audit[width] = data;

    // Capture screenshots
    if (width === 1440) {
      const sectionEl = await page.$('.rh-how-works-section');
      if (sectionEl) {
        await sectionEl.screenshot({
          path: path.join(artifactDir, 'how-rapira-works-desktop.png')
        });
      }
    }

    if (width === 768) {
      const sectionEl = await page.$('.rh-how-works-section');
      if (sectionEl) {
        await sectionEl.screenshot({
          path: path.join(artifactDir, 'how-rapira-works-tablet.png')
        });
      }
    }

    if (width === 375) {
      // 1. Mobile First Card View
      const sectionEl = await page.$('.rh-how-works-section');
      if (sectionEl) {
        await sectionEl.screenshot({
          path: path.join(artifactDir, 'how-rapira-works-mobile-card1.png')
        });
      }

      // 2. Swipe to Card 2 via scrollIntoView
      await page.evaluate(() => {
        const track = document.getElementById('howWorksTrack');
        const cards = track ? track.querySelectorAll('.rh-how-card') : [];
        if (cards.length > 1) {
          cards[1].scrollIntoView({ behavior: 'instant', inline: 'start', block: 'nearest' });
        }
      });
      await new Promise(r => setTimeout(r, 600));

      if (sectionEl) {
        await sectionEl.screenshot({
          path: path.join(artifactDir, 'how-rapira-works-mobile-card2.png')
        });
      }
    }

    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(audit, null, 2));
  fs.writeFileSync(path.join(artifactDir, 'how-works-audit.json'), JSON.stringify(audit, null, 2));
})();
