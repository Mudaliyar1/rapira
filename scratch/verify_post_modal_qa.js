const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';
const SESSION_COOKIE = 'testsessionvenue1234567890abcdef1234567890abcdef1234567890abcdef';
const ARTIST_URL = 'http://localhost:3000/artists/699b435b1d3cc57e880c8ccd';
const POST_ID = '69de6beaa119f466ea9f91bd';

async function runQA() {
  console.log('[QA] Launching Puppeteer...');
  const os = require('os');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_post_qa_'));

  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tempDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Set session cookie
  await page.setCookie({
    name: 'rapira.sid',
    value: SESSION_COOKIE,
    domain: 'localhost',
    path: '/'
  });

  console.log('[QA] Navigating to artist page:', ARTIST_URL);
  await page.goto(ARTIST_URL, { waitUntil: 'networkidle2', timeout: 30000 });

  console.log('[QA] Opening post modal for post ID:', POST_ID);
  await page.evaluate((postId) => {
    if (typeof viewPost === 'function') {
      viewPost(postId);
    } else {
      console.error('viewPost function not found on window');
    }
  }, POST_ID);

  // Wait for modal to become visible and comments to load
  await page.waitForSelector('#post-viewer.show', { timeout: 10000 });
  await page.waitForSelector('#post-inline-comments-list .comment-card', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1500));

  console.log('[QA] Checking comment readability and styling...');
  const commentStyles = await page.evaluate(() => {
    const card = document.querySelector('#post-inline-comments-list .comment-card');
    const author = card?.querySelector('.rh-viewer-comment-author') || card?.querySelector('strong');
    const text = card?.querySelector('.rh-viewer-comment-text') || card?.querySelector('p');
    const date = card?.querySelector('.rh-viewer-comment-date') || card?.querySelector('small');
    const replyCard = document.querySelector('#post-inline-comments-list .reply-card');
    const replyAuthor = replyCard?.querySelector('.rh-viewer-reply-author') || replyCard?.querySelector('strong');
    const replyText = replyCard?.querySelector('.rh-viewer-reply-text') || replyCard?.querySelector('p');
    const replyDate = replyCard?.querySelector('.rh-viewer-reply-date') || replyCard?.querySelector('small');
    const replyActionBtn = card?.querySelector('.rh-viewer-reply-action-btn');
    const modalContent = document.querySelector('.rh-viewer-content');

    const getColors = (el) => {
      if (!el) return null;
      const s = window.getComputedStyle(el);
      return {
        color: s.color,
        fontWeight: s.fontWeight,
        fontSize: s.fontSize,
        borderLeft: s.borderLeft
      };
    };

    return {
      modalBackground: modalContent ? window.getComputedStyle(modalContent).backgroundColor : null,
      commentAuthor: getColors(author),
      commentText: getColors(text),
      commentDate: getColors(date),
      replyAuthor: getColors(replyAuthor),
      replyText: getColors(replyText),
      replyDate: getColors(replyDate),
      replyBorder: replyCard ? window.getComputedStyle(replyCard).borderLeft : null,
      replyActionColor: replyActionBtn ? window.getComputedStyle(replyActionBtn).color : null
    };
  });

  console.log('[QA] Comment Styles Result:', JSON.stringify(commentStyles, null, 2));

  console.log('[QA] Checking Audio Player state...');
  const audioState = await page.evaluate(() => {
    const audio = document.querySelector('#post-media-container audio');
    const playBtn = document.querySelector('#post-media-container button[aria-label]');
    const timeDisplay = document.querySelector('#post-media-container span');
    return {
      hasAudio: !!audio,
      audioPaused: audio ? audio.paused : null,
      audioSrc: audio ? audio.src : null,
      playBtnIcon: playBtn ? playBtn.innerHTML : null,
      playBtnLabel: playBtn ? playBtn.getAttribute('aria-label') : null
    };
  });
  console.log('[QA] Audio Initial State:', JSON.stringify(audioState, null, 2));

  // Test Play Button click
  console.log('[QA] Clicking Play Button...');
  await page.evaluate(() => {
    const playBtn = document.querySelector('#post-media-container button[aria-label]');
    if (playBtn) playBtn.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  const audioPlayingState = await page.evaluate(() => {
    const audio = document.querySelector('#post-media-container audio');
    const playBtn = document.querySelector('#post-media-container button[aria-label]');
    return {
      paused: audio ? audio.paused : null,
      currentTime: audio ? audio.currentTime : 0,
      duration: audio ? audio.duration : 0,
      playBtnIcon: playBtn ? playBtn.innerHTML : null
    };
  });
  console.log('[QA] Audio Playing State:', JSON.stringify(audioPlayingState, null, 2));

  // Test Pause Button click
  console.log('[QA] Clicking Pause Button...');
  await page.evaluate(() => {
    const playBtn = document.querySelector('#post-media-container button[aria-label]');
    if (playBtn) playBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const audioPausedState = await page.evaluate(() => {
    const audio = document.querySelector('#post-media-container audio');
    const playBtn = document.querySelector('#post-media-container button[aria-label]');
    return {
      paused: audio ? audio.paused : null,
      playBtnIcon: playBtn ? playBtn.innerHTML : null
    };
  });
  console.log('[QA] Audio Paused State:', JSON.stringify(audioPausedState, null, 2));

  // Capture Desktop Screenshot
  const desktopScreenshotPath = path.join(ARTIFACT_DIR, 'post-modal-after-desktop-1440px.png');
  await page.screenshot({ path: desktopScreenshotPath });
  console.log('[QA] Saved desktop screenshot to:', desktopScreenshotPath);

  // Test Mobile Viewport
  console.log('[QA] Testing mobile viewport 375x812...');
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  await new Promise(r => setTimeout(r, 1000));

  const mobileScreenshotPath = path.join(ARTIFACT_DIR, 'post-modal-after-mobile-375px.png');
  await page.screenshot({ path: mobileScreenshotPath });
  console.log('[QA] Saved mobile screenshot to:', mobileScreenshotPath);

  await browser.close();
  console.log('[QA] Verification finished successfully!');
}

runQA().catch(err => {
  console.error('[QA] Error running verification:', err);
  process.exit(1);
});
