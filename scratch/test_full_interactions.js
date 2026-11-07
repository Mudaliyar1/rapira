const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  // Scroll and click card
  await page.evaluate(() => {
    const card = document.querySelector('.rh-reel-card');
    card.scrollIntoView();
    card.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const inspection = await page.evaluate(() => {
    const modal = document.getElementById('rhReelModal');
    const dialog = document.querySelector('.rh-reel-modal-dialog');
    const rail = document.querySelector('.rh-reel-action-rail');
    const info = document.querySelector('.rh-reel-info-col');
    const nav = document.querySelector('.navbar');
    const banner = document.getElementById('websiteUpdateBanner');
    const chatbot = document.querySelector('.chatbot-toggle') || document.querySelector('.chatbot-container');
    const closeBtn = document.querySelector('.rh-reel-modal-close');

    const modalRect = modal ? modal.getBoundingClientRect() : null;
    const dialogRect = dialog ? dialog.getBoundingClientRect() : null;
    const railRect = rail ? rail.getBoundingClientRect() : null;
    const infoRect = info ? info.getBoundingClientRect() : null;
    const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;

    // Engagement items
    const likeBtn = document.getElementById('rhReelLikeBtn');
    const commentBtn = document.getElementById('rhReelCommentBtn');
    const likeCount = document.getElementById('rhReelLikeCount')?.textContent;
    const commentCount = document.getElementById('rhReelCommentCount')?.textContent;

    return {
      bodyHasClass: document.body.classList.contains('rh-modal-open'),
      navHidden: nav ? window.getComputedStyle(nav).display === 'none' : true,
      bannerHidden: banner ? window.getComputedStyle(banner).display === 'none' : true,
      chatbotHidden: chatbot ? window.getComputedStyle(chatbot).display === 'none' : true,
      modalRect: { width: modalRect.width, height: modalRect.height },
      dialogRect: { width: dialogRect.width, height: dialogRect.height },
      railRect: { width: railRect.width, height: railRect.height, left: railRect.left, right: railRect.right, bottom: railRect.bottom },
      infoRect: { width: infoRect.width, height: infoRect.height, left: infoRect.left, right: infoRect.right, bottom: infoRect.bottom },
      closeRect: { width: closeRect.width, height: closeRect.height, right: closeRect.right, top: closeRect.top },
      isRailOnRight: railRect.left > infoRect.right,
      hasCollision: infoRect.right > railRect.left,
      likeCount,
      commentCount
    };
  });

  console.log('Mobile Modal Inspection:', JSON.stringify(inspection, null, 2));

  // Test Comment Drawer
  console.log('Testing Comment Drawer toggle...');
  await page.evaluate(() => window.toggleReelComments());
  await new Promise(r => setTimeout(r, 400));
  const drawerOpen = await page.evaluate(() => {
    const d = document.getElementById('rhReelCommentsDrawer');
    return d ? d.classList.contains('active') : false;
  });
  console.log('Drawer opened:', drawerOpen);

  // Test Like Toggle
  console.log('Testing Like toggle...');
  const likeBefore = await page.evaluate(() => {
    const icon = document.getElementById('rhReelLikeIcon');
    const count = document.getElementById('rhReelLikeCount');
    return { isLiked: icon.classList.contains('bi-heart-fill'), count: count.textContent };
  });
  await page.evaluate(() => window.toggleCurrentReelLike());
  const likeAfter = await page.evaluate(() => {
    const icon = document.getElementById('rhReelLikeIcon');
    const count = document.getElementById('rhReelLikeCount');
    return { isLiked: icon.classList.contains('bi-heart-fill'), count: count.textContent };
  });
  console.log('Like toggle: before =', likeBefore, 'after =', likeAfter);

  // Test Close Modal
  console.log('Testing Close Modal...');
  await page.evaluate(() => window.closeRapiraReelModal());
  await new Promise(r => setTimeout(r, 400));
  const closedState = await page.evaluate(() => {
    const modal = document.getElementById('rhReelModal');
    const nav = document.querySelector('.navbar');
    return {
      bodyHasClass: document.body.classList.contains('rh-modal-open'),
      modalDisplay: modal.style.display,
      navDisplay: nav ? window.getComputedStyle(nav).display : null
    };
  });
  console.log('Closed state:', closedState);

  await browser.close();
}

test().catch(console.error);

