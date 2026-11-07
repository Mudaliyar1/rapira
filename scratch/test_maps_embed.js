const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const query = encodeURIComponent('Ahmedabad, Gujarat 380026');
  const embedUrl = 'https://maps.google.com/maps?q=' + query + '&t=&z=14&ie=UTF8&iwloc=&output=embed';

  const html = `<!DOCTYPE html>
  <html>
    <body style="margin: 0; background: #FAECDF;">
      <iframe id="mapFrame" src="${embedUrl}" width="400" height="250" style="border:0; border-radius: 12px;"></iframe>
    </body>
  </html>`;

  await page.setContent(html);
  await new Promise(r => setTimeout(r, 4000));

  await page.screenshot({ path: 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d/test-map-embed.png' });
  console.log('Saved test-map-embed.png');
  await browser.close();
})();

