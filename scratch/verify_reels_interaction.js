const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d';

async function runInteractionTest() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set desktop viewport
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  // Scroll to section 5: Trending Reels
  await page.evaluate(() => {
    const el = document.getElementById('homeReelsContainer');
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await new Promise(r => setTimeout(r, 2000));

  // Take screenshot of Trending Reels section on desktop
  const section = await page.evaluateHandle(() => {
    const el = document.getElementById('homeReelsContainer');
    return el ? el.closest('section') : null;
  });
  if (section) {
    await section.screenshot({
      path: path.join(ARTIFACT_DIR, 'reels-preview-restored-desktop.png')
    });
  }

  // Find index of first video reel and first audio reel
  const reelTypes = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.rh-reel-card'));
    let videoIdx = -1;
    let audioIdx = -1;
    cards.forEach((c, i) => {
      if (c.dataset.mediaType === 'video' && videoIdx === -1) videoIdx = i;
      if (c.dataset.mediaType === 'audio' && audioIdx === -1) audioIdx = i;
    });
    return { videoIdx, audioIdx, totalCards: cards.length };
  });

  console.log('Reel types available:', JSON.stringify(reelTypes));

  // Test 1: Click Video Reel
  if (reelTypes.videoIdx !== -1) {
    console.log(`Testing Video Reel Click (card ${reelTypes.videoIdx + 1})...`);
    await page.click(`.rh-reel-card:nth-child(${reelTypes.videoIdx + 1})`);
    await new Promise(r => setTimeout(r, 1200));

    const videoModalState = await page.evaluate(() => {
      const modal = document.getElementById('rhReelModal');
      const video = document.getElementById('rhReelVideo');
      const authorName = document.getElementById('rhReelAuthorName');
      const authorImg = document.getElementById('rhReelAuthorImg');
      return {
        isOpen: modal ? modal.style.display !== 'none' : false,
        videoSrc: video ? video.src : null,
        videoVisible: video ? window.getComputedStyle(video).display !== 'none' : false,
        authorName: authorName ? authorName.innerText : null,
        authorImgSrc: authorImg ? authorImg.src : null
      };
    });
    console.log('Video Modal State:', JSON.stringify(videoModalState, null, 2));

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'reels-viewer-video-modal.png')
    });

    await page.evaluate(() => window.closeRapiraReelModal());
    await new Promise(r => setTimeout(r, 600));
  }

  // Test 2: Click Audio Reel
  if (reelTypes.audioIdx !== -1) {
    console.log(`Testing Audio Reel Click (card ${reelTypes.audioIdx + 1})...`);
    await page.click(`.rh-reel-card:nth-child(${reelTypes.audioIdx + 1})`);
    await new Promise(r => setTimeout(r, 1200));

    const audioModalState = await page.evaluate(() => {
      const modal = document.getElementById('rhReelModal');
      const audio = document.getElementById('rhReelAudio');
      const audioStage = document.getElementById('rhReelAudioStage');
      const authorName = document.getElementById('rhReelAuthorName');
      const authorImg = document.getElementById('rhReelAuthorImg');
      const audioThumb = document.getElementById('rhReelAudioThumb');
      return {
        isOpen: modal ? modal.style.display !== 'none' : false,
        audioSrc: audio ? audio.src : null,
        audioStageVisible: audioStage ? window.getComputedStyle(audioStage).display !== 'none' : false,
        audioThumbSrc: audioThumb ? audioThumb.src : null,
        authorName: authorName ? authorName.innerText : null,
        authorImgSrc: authorImg ? authorImg.src : null
      };
    });
    console.log('Audio Modal State:', JSON.stringify(audioModalState, null, 2));

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'reels-viewer-audio-modal.png')
    });

    await page.evaluate(() => window.closeRapiraReelModal());
    await new Promise(r => setTimeout(r, 600));
  }

  // Test 3: Mobile Viewport (375x812)
  console.log('Testing Mobile Viewport (375x812)...');
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle2' });

  await page.evaluate(() => {
    const el = document.getElementById('homeReelsContainer');
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await new Promise(r => setTimeout(r, 2000));

  const mobileSection = await page.evaluateHandle(() => {
    const el = document.getElementById('homeReelsContainer');
    return el ? el.closest('section') : null;
  });
  if (mobileSection) {
    await mobileSection.screenshot({
      path: path.join(ARTIFACT_DIR, 'reels-preview-restored-mobile.png')
    });
  }

  const mobileMetrics = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.rh-reel-card'));
    const imagesLoaded = cards.map(c => {
      const img = c.querySelector('img.rh-reel-media');
      return {
        complete: img ? img.complete : false,
        naturalWidth: img ? img.naturalWidth : 0
      };
    });
    return {
      totalCards: cards.length,
      allImagesLoaded: imagesLoaded.every(img => img.complete && img.naturalWidth > 0),
      imagesLoaded,
      scrollWidth: document.documentElement.scrollWidth,
      windowWidth: window.innerWidth
    };
  });
  console.log('Mobile Metrics:', JSON.stringify(mobileMetrics, null, 2));

  await browser.close();
}

runInteractionTest().catch(console.error);
