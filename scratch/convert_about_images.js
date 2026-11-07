const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function processImages() {
  const destDir = 'd:/Nightcode/rapira/public/images/about';
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const srcStory = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d/indian_hip_hop_concert_1793941177757.jpg';
  const srcMission = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d/indian_studio_collaboration_1793941195457.jpg';

  // 1. Process Our Story Image
  const storyMeta = await sharp(srcStory).metadata();
  console.log('Story original dimensions:', storyMeta.width, 'x', storyMeta.height);

  await sharp(srcStory)
    .webp({ quality: 90, effort: 6 })
    .toFile(path.join(destDir, 'our-story.webp'));
  
  await sharp(srcStory)
    .jpeg({ quality: 92, progressive: true })
    .toFile(path.join(destDir, 'our-story.jpg'));

  console.log('Saved our-story.webp & our-story.jpg');

  // 2. Process Our Mission Image
  const missionMeta = await sharp(srcMission).metadata();
  console.log('Mission original dimensions:', missionMeta.width, 'x', missionMeta.height);

  await sharp(srcMission)
    .webp({ quality: 90, effort: 6 })
    .toFile(path.join(destDir, 'our-mission.webp'));

  await sharp(srcMission)
    .jpeg({ quality: 92, progressive: true })
    .toFile(path.join(destDir, 'our-mission.jpg'));

  console.log('Saved our-mission.webp & our-mission.jpg');
}

processImages().catch(err => {
  console.error('Error processing images:', err);
  process.exit(1);
});

