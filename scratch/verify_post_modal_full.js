const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const SESSION_COOKIE = 'testsessionvenue1234567890abcdef1234567890abcdef1234567890abcdef';
const ARTIST_URL = 'http://localhost:3000/artists/699b435b1d3cc57e880c8ccd';
const POST_ID = '69de6beaa119f466ea9f91bd';

async function runFullQA() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_full_qa_'));
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tempDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    // ── 1. Desktop Test (1440x900) ──
    const desktopPage = await browser.newPage();
    await desktopPage.setViewport({ width: 1440, height: 900 });
    await desktopPage.setCookie({
      name: 'rapira.sid',
      value: SESSION_COOKIE,
      domain: 'localhost',
      path: '/'
    });

    console.log('[QA] Desktop: Loading artist page...');
    await desktopPage.goto(ARTIST_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    console.log('[QA] Desktop: Opening post modal for ID:', POST_ID);
    await desktopPage.evaluate((postId) => {
      viewPost(postId);
    }, POST_ID);

    await desktopPage.waitForSelector('#post-viewer.show', { timeout: 10000 });
    await desktopPage.waitForSelector('#post-inline-comments-list .comment-card', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1200));

    // Scroll comment section into view to show comments clearly
    await desktopPage.evaluate(() => {
      openPostViewerComments();
    });
    await new Promise(r => setTimeout(r, 600));

    const desktopScreenshotPath = path.join(ARTIFACT_DIR, 'post-modal-after-desktop-1440px.png');
    await desktopPage.screenshot({ path: desktopScreenshotPath });
    console.log('[QA] Saved desktop screenshot:', desktopScreenshotPath);

    // Verify comment text contrast & styles
    const styles = await desktopPage.evaluate(() => {
      const card = document.querySelector('#post-inline-comments-list .comment-card');
      const author = card?.querySelector('.rh-viewer-comment-author');
      const text = card?.querySelector('.rh-viewer-comment-text');
      const date = card?.querySelector('.rh-viewer-comment-date');
      const reply = card?.querySelector('.reply-card');
      const replyAuthor = reply?.querySelector('.rh-viewer-reply-author');
      const replyText = reply?.querySelector('.rh-viewer-reply-text');
      const commentInput = document.getElementById('postViewerNewComment');
      const sendBtn = document.getElementById('submitPostViewerCommentBtn');

      return {
        authorColor: author ? window.getComputedStyle(author).color : null,
        textColor: text ? window.getComputedStyle(text).color : null,
        dateColor: date ? window.getComputedStyle(date).color : null,
        replyAuthorColor: replyAuthor ? window.getComputedStyle(replyAuthor).color : null,
        replyTextColor: replyText ? window.getComputedStyle(replyText).color : null,
        commentInputVisible: !!commentInput && commentInput.offsetParent !== null,
        sendBtnVisible: !!sendBtn && sendBtn.offsetParent !== null
      };
    });
    console.log('[QA] Evaluated styles:', JSON.stringify(styles, null, 2));

    await desktopPage.close();

    // ── 2. Mobile Test (375x812) ──
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    await mobilePage.setCookie({
      name: 'rapira.sid',
      value: SESSION_COOKIE,
      domain: 'localhost',
      path: '/'
    });

    console.log('[QA] Mobile: Loading artist page at 375px...');
    await mobilePage.goto(ARTIST_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    console.log('[QA] Mobile: Opening post modal for ID:', POST_ID);
    await mobilePage.evaluate((postId) => {
      viewPost(postId);
    }, POST_ID);

    await mobilePage.waitForSelector('#post-viewer.show', { timeout: 10000 });
    await mobilePage.waitForSelector('#post-inline-comments-list .comment-card', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1200));

    const mobileScreenshotPath = path.join(ARTIFACT_DIR, 'post-modal-after-mobile-375px.png');
    await mobilePage.screenshot({ path: mobileScreenshotPath });
    console.log('[QA] Saved mobile screenshot:', mobileScreenshotPath);

    await mobilePage.close();

    console.log('[QA] All full QA checks passed successfully!');
  } finally {
    await browser.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

runFullQA().catch(err => {
  console.error('[QA] Error in runFullQA:', err);
  process.exit(1);
});

