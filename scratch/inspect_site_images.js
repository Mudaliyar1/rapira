const puppeteer = require('d:/Nightcode/rapira/node_modules/puppeteer');

async function scrapeImages() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const urls = [
    'http://localhost:3000/',
    'http://localhost:3000/concerts',
    'http://localhost:3000/artists',
    'http://localhost:3000/content'
  ];

  for (const u of urls) {
    try {
      await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const images = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img, [style*="background-image"]')).map(el => {
          if (el.tagName === 'IMG') {
            return { tag: 'img', src: el.src, alt: el.alt, class: el.className };
          } else {
            return { tag: 'bg', style: el.getAttribute('style'), class: el.className };
          }
        });
      });
      console.log(`=== URL: ${u} (${images.length} images/bgs) ===`);
      images.forEach(img => {
        if (img.src && !img.src.startsWith('data:')) {
          console.log(`  SRC: ${img.src} | ALT: ${img.alt} | CLASS: ${img.class}`);
        } else if (img.style && img.style.includes('url')) {
          console.log(`  BG: ${img.style} | CLASS: ${img.class}`);
        }
      });
    } catch (e) {
      console.log(`Error loading ${u}:`, e.message);
    }
  }

  await browser.close();
}

scrapeImages();
