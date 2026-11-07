const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  // 1. Open the first reel
  await page.click('.rh-reel-card');
  await new Promise(r => setTimeout(r, 600));

  const state = await page.evaluate(() => {
    const modal = document.getElementById('rhReelModal');
    const nav = document.querySelector('.navbar');
    const rail = document.querySelector('.rh-reel-action-rail');
    const info = document.querySelector('.rh-reel-info-col');
    const authorName = document.getElementById('rhReelAuthorName');
    const caption = document.getElementById('rhReelCaption');
    const likeBtn = document.getElementById('rhReelLikeBtn');
    const commentBtn = document.getElementById('rhReelCommentBtn');
    const likeCount = document.getElementById('rhReelLikeCount');
    const commentCount = document.getElementById('rhReelCommentCount');
    const closeBtn = document.querySelector('.rh-reel-modal-close');

    const navStyle = nav ? window.getComputedStyle(nav) : null;
    const railRect = rail ? rail.getBoundingClientRect() : null;
    const infoRect = info ? info.getBoundingClientRect() : null;
    const modalRect = modal ? modal.getBoundingClientRect() : null;

    return {
      modalDisplay: modal ? window.getComputedStyle(modal).display : null,
      bodyHasClass: document.body.classList.contains('rh-modal-open'),
      navDisplay: navStyle ? navStyle.display : null,
      navVisibility: navStyle ? navStyle.visibility : null,
      railRect,
      infoRect,
      modalRect,
      hasCollision: (infoRect && railRect) ? (infoRect.right > railRect.left) : false,
      authorName: authorName ? authorName.textContent : null,
      caption: caption ? caption.textContent.substring(0, 50) : null,
      likeCount: likeCount ? likeCount.textContent : null,
      commentCount: commentCount ? commentCount.textContent : null,
      closeBtnVisible: !!closeBtn
    };
  });

  console.log('Mobile Viewer State:', JSON.stringify(state, null, 2));

  await browser.close();
}

test().catch(console.error);

