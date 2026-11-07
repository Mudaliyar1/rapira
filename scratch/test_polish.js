const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  // 1. Inspect How RAPIRA Works Pagination
  const paginationInfo = await page.evaluate(() => {
    const pag = document.getElementById('howWorksPagination');
    const dots = Array.from(document.querySelectorAll('.rh-how-dot'));
    const track = document.getElementById('howWorksTrack');

    return {
      pagination: {
        display: window.getComputedStyle(pag).display,
        flexDirection: window.getComputedStyle(pag).flexDirection,
        justifyContent: window.getComputedStyle(pag).justifyContent,
        alignItems: window.getComputedStyle(pag).alignItems,
        rect: {
          x: Math.round(pag.getBoundingClientRect().x),
          width: Math.round(pag.getBoundingClientRect().width),
          top: Math.round(pag.getBoundingClientRect().top)
        }
      },
      dots: dots.map((d, i) => {
        const r = d.getBoundingClientRect();
        const cs = window.getComputedStyle(d);
        return {
          index: i,
          active: d.classList.contains('active'),
          x: Math.round(r.x),
          y: Math.round(r.y),
          width: Math.round(r.width),
          height: Math.round(r.height),
          bg: cs.backgroundColor,
          borderRadius: cs.borderRadius
        };
      })
    };
  });

  console.log('--- PAGINATION INFO (375px) ---');
  console.log(JSON.stringify(paginationInfo, null, 2));

  // Check if dots are horizontally in one row (same y coordinate)
  const dotYs = paginationInfo.dots.map(d => d.y);
  const allSameY = dotYs.every(y => y === dotYs[0]);
  console.log('Are all dots on the same horizontal row (same Y)?', allSameY, dotYs);

  // Check centering of dots container relative to screen
  const containerCenter = paginationInfo.pagination.rect.x + paginationInfo.pagination.rect.width / 2;
  console.log('Pagination container center X:', containerCenter, '(Target: 187.5px for 375px width)');

  // 2. Test Dot Click Navigation
  console.log('\n--- TESTING DOT CLICK NAVIGATION ---');
  // Click dot 1 (second card)
  await page.evaluate(() => {
    const dots = document.querySelectorAll('.rh-how-dot');
    if (dots[1]) dots[1].click();
  });
  await new Promise(r => setTimeout(r, 600));

  const afterClick1 = await page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll('.rh-how-dot'));
    const track = document.getElementById('howWorksTrack');
    return {
      scrollLeft: track ? track.scrollLeft : 0,
      activeDotIndex: dots.findIndex(d => d.classList.contains('active'))
    };
  });
  console.log('After clicking Dot 1 (Card 2):', afterClick1);

  // Click dot 2 (third card)
  await page.evaluate(() => {
    const dots = document.querySelectorAll('.rh-how-dot');
    if (dots[2]) dots[2].click();
  });
  await new Promise(r => setTimeout(r, 600));

  const afterClick2 = await page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll('.rh-how-dot'));
    const track = document.getElementById('howWorksTrack');
    return {
      scrollLeft: track ? track.scrollLeft : 0,
      activeDotIndex: dots.findIndex(d => d.classList.contains('active'))
    };
  });
  console.log('After clicking Dot 2 (Card 3):', afterClick2);

  // Click dot 0 (first card)
  await page.evaluate(() => {
    const dots = document.querySelectorAll('.rh-how-dot');
    if (dots[0]) dots[0].click();
  });
  await new Promise(r => setTimeout(r, 600));

  const afterClick0 = await page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll('.rh-how-dot'));
    const track = document.getElementById('howWorksTrack');
    return {
      scrollLeft: track ? track.scrollLeft : 0,
      activeDotIndex: dots.findIndex(d => d.classList.contains('active'))
    };
  });
  console.log('After clicking Dot 0 (Card 1):', afterClick0);

  // 3. Inspect Artist CTA
  console.log('\n--- ARTIST CTA INFO (375px) ---');
  const ctaInfo = await page.evaluate(() => {
    const section = document.querySelector('.rh-artist-cta-section');
    const card = document.querySelector('.rh-artist-cta-card');
    const title = document.querySelector('.rh-artist-cta-title');
    const desc = document.querySelector('.rh-artist-cta-desc');
    const action = document.querySelector('.rh-artist-cta-action');
    const btn = document.querySelector('.rh-cta-action-btn');

    const cardRect = card.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();

    const cardCenter = cardRect.left + cardRect.width / 2;
    const btnCenter = btnRect.left + btnRect.width / 2;

    return {
      titleAlign: window.getComputedStyle(title).textAlign,
      descAlign: window.getComputedStyle(desc).textAlign,
      actionJustify: window.getComputedStyle(action).justifyContent,
      cardWidth: Math.round(cardRect.width),
      cardLeft: Math.round(cardRect.left),
      cardCenter: Math.round(cardCenter),
      btnWidth: Math.round(btnRect.width),
      btnLeft: Math.round(btnRect.left),
      btnRight: Math.round(btnRect.right),
      btnCenter: Math.round(btnCenter),
      btnCenteredInCard: Math.abs(cardCenter - btnCenter) < 2,
      leftMargin: Math.round(btnRect.left - cardRect.left),
      rightMargin: Math.round(cardRect.right - btnRect.right)
    };
  });
  console.log(JSON.stringify(ctaInfo, null, 2));

  // 4. Desktop Check (1440px)
  console.log('\n--- DESKTOP CHECK (1440px) ---');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  const desktopInfo = await page.evaluate(() => {
    const pag = document.getElementById('howWorksPagination');
    const action = document.querySelector('.rh-artist-cta-action');
    const btn = document.querySelector('.rh-cta-action-btn');
    return {
      paginationDisplay: pag ? window.getComputedStyle(pag).display : 'none',
      actionJustify: action ? window.getComputedStyle(action).justifyContent : '',
      btnAlign: btn ? window.getComputedStyle(btn).marginLeft : ''
    };
  });
  console.log('Desktop State:', desktopInfo);

  await browser.close();
})();

