const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('response', resp => {
    if (resp.url().includes('cloudinary') || resp.url().includes('default-thumbnail') || resp.url().includes('artist-posts')) {
      console.log('HTTP', resp.status(), resp.url().substring(0, 90));
    }
  });

  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  // Scroll into view
  await page.evaluate(() => {
    const el = document.getElementById('homeReelsContainer');
    if (el) el.scrollIntoView();
  });

  // Give images time to load
  await new Promise(r => setTimeout(r, 2500));

  const cardsData = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.rh-reel-card'));
    return cards.map((c, i) => {
      const img = c.querySelector('img.rh-reel-media');
      const video = c.querySelector('video.rh-reel-media');
      const playBtn = c.querySelector('.rh-reel-play-btn');
      const avatar = c.querySelector('.rh-reel-avatar');
      const handle = c.querySelector('.rh-reel-handle');

      // Check text nodes for raw attributes
      const textNodes = Array.from(c.childNodes)
        .filter(n => n.nodeType === 3)
        .map(n => n.nodeValue.trim())
        .filter(t => t.length > 0);

      const cardRect = c.getBoundingClientRect();
      const imgRect = img ? img.getBoundingClientRect() : null;

      return {
        index: i,
        reelId: c.dataset.reelId,
        mediaType: c.dataset.mediaType,
        mediaUrl: c.dataset.mediaUrl,
        posterUrl: c.dataset.posterUrl,
        artistName: c.dataset.artistName,
        hasImg: !!img,
        imgSrc: img ? img.src : null,
        imgNaturalWidth: img ? img.naturalWidth : null,
        imgNaturalHeight: img ? img.naturalHeight : null,
        imgComplete: img ? img.complete : null,
        hasVideo: !!video,
        hasPlayBtn: !!playBtn,
        hasAvatar: !!avatar,
        handleText: handle ? handle.innerText : null,
        rawTextNodes: textNodes,
        cardBounds: { top: Math.round(cardRect.top), height: Math.round(cardRect.height), width: Math.round(cardRect.width) },
        imgBounds: imgRect ? { top: Math.round(imgRect.top), height: Math.round(imgRect.height), width: Math.round(imgRect.width) } : null
      };
    });
  });

  console.log('=== FIXED REELS EVALUATION ===');
  console.log(JSON.stringify(cardsData, null, 2));

  await browser.close();
})();

