const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  const reelsInfo = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.rh-reel-card'));
    return cards.map((c, i) => {
      const img = c.querySelector('img.rh-reel-media');
      const video = c.querySelector('video.rh-reel-media');
      return {
        index: i,
        outerHTML: c.outerHTML.substring(0, 300),
        innerText: c.innerText.substring(0, 150),
        hasImg: !!img,
        imgSrc: img ? img.src : null,
        imgNaturalWidth: img ? img.naturalWidth : null,
        imgComplete: img ? img.complete : null,
        hasVideo: !!video,
        videoSrc: video ? video.src : null,
        childNodes: Array.from(c.childNodes).map(n => ({
          nodeType: n.nodeType,
          nodeName: n.nodeName,
          nodeValue: n.nodeValue ? n.nodeValue.substring(0, 100) : null
        }))
      };
    });
  });

  console.log('Found Reel Cards:', reelsInfo.length);
  console.log(JSON.stringify(reelsInfo[0], null, 2));

  await browser.close();
})();

