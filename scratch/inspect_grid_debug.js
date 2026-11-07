const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROFILE_URL = 'http://localhost:3000/artists/699b435b1d3cc57e880c8ccd';

async function inspectGrid() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_grid_inspect_'));
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tempDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812 });
    await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    const info = await page.evaluate(() => {
      const firstCard = document.querySelector('.rh-ap-post-card');
      const parentCol = firstCard?.parentElement;
      const row = parentCol?.parentElement;
      const col8 = row?.parentElement;

      return {
        row: {
          tag: row?.tagName,
          className: row?.className,
          display: row ? window.getComputedStyle(row).display : null,
          flexWrap: row ? window.getComputedStyle(row).flexWrap : null,
          width: row ? row.offsetWidth : null
        },
        parentCol: {
          className: parentCol?.className,
          width: parentCol ? parentCol.offsetWidth : null,
          display: parentCol ? window.getComputedStyle(parentCol).display : null,
          flex: parentCol ? window.getComputedStyle(parentCol).flex : null,
          maxWidth: parentCol ? window.getComputedStyle(parentCol).maxWidth : null,
          float: parentCol ? window.getComputedStyle(parentCol).float : null,
          clear: parentCol ? window.getComputedStyle(parentCol).clear : null
        },
        secondCol: {
          className: parentCol?.nextElementSibling?.className,
          top: parentCol?.nextElementSibling?.offsetTop,
          left: parentCol?.nextElementSibling?.offsetLeft,
          width: parentCol?.nextElementSibling?.offsetWidth
        }
      };
    });

    console.log('GRID DEBUG INFO:', JSON.stringify(info, null, 2));
  } finally {
    await browser.close();
  }
}

inspectGrid();

