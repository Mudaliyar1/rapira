const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function processHeroMic() {
  const destDir = 'd:/Nightcode/rapira/public/images/content-library';
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const srcPath = 'C:/Users/abc/.gemini/antigravity/brain/97005936-a5e5-495e-bea8-18c87a610b4d/studio_microphone_setup_clean_1793943311158.jpg';
  const meta = await sharp(srcPath).metadata();
  console.log('Original hero mic dimensions:', meta.width, 'x', meta.height);

  // Save optimized WebP
  await sharp(srcPath)
    .webp({ quality: 90, effort: 6 })
    .toFile(path.join(destDir, 'hero-mic.webp'));

  // Save fallback JPEG
  await sharp(srcPath)
    .jpeg({ quality: 92, progressive: true })
    .toFile(path.join(destDir, 'hero-mic.jpg'));

  console.log('Successfully saved hero-mic.webp and hero-mic.jpg in public/images/content-library/');
}

processHeroMic().catch(err => {
  console.error('Error processing hero mic image:', err);
  process.exit(1);
});

