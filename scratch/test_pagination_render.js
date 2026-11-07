const puppeteer = require('d:/Nightcode/rapira/node_modules/puppeteer');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/content', { waitUntil: 'networkidle2' });

  await page.evaluate(() => {
    const container = document.querySelector('.rh-cl-grid-section .container');
    const nav = document.createElement('nav');
    nav.className = 'rh-cl-pagination-container my-5';
    nav.innerHTML = `
      <ul class="rh-cl-pagination-list">
        <li class="rh-cl-page-item"><a class="rh-cl-page-link rh-cl-nav-arrow" href="#"><i class="bi bi-chevron-left"></i></a></li>
        <li class="rh-cl-page-item active"><a class="rh-cl-page-link" href="#">1</a></li>
        <li class="rh-cl-page-item"><a class="rh-cl-page-link" href="#">2</a></li>
        <li class="rh-cl-page-item"><a class="rh-cl-page-link" href="#">3</a></li>
        <li class="rh-cl-page-item disabled"><span class="rh-cl-page-ellipsis">…</span></li>
        <li class="rh-cl-page-item"><a class="rh-cl-page-link" href="#">8</a></li>
        <li class="rh-cl-page-item"><a class="rh-cl-page-link rh-cl-nav-arrow" href="#"><i class="bi bi-chevron-right"></i></a></li>
      </ul>
    `;
    container.appendChild(nav);
  });

  const paginationPath = path.join(ARTIFACT_DIR, 'content-library-pagination-preview.png');
  const navEl = await page.$('.rh-cl-pagination-container');
  if (navEl) {
    await navEl.screenshot({ path: paginationPath });
    console.log('Pagination preview screenshot saved to:', paginationPath);
  }

  // Also full desktop with pagination
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'content-library-desktop-with-pagination.png'), fullPage: true });

  await browser.close();
})();

