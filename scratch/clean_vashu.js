const sharp = require('sharp');
const fs = require('fs');

(async () => {
  const vashuPath = 'public/images/artists/vashu.jpg';
  const rawInput = fs.readFileSync(vashuPath);
  
  // 1. Overlay a black rectangle over the top right corner
  const blackPatchSvg = `
    <svg width="400" height="304" viewBox="0 0 400 304">
      <rect x="250" y="0" width="150" height="60" fill="#030303" />
    </svg>
  `;

  const patched = await sharp(rawInput)
    .composite([{ input: Buffer.from(blackPatchSvg), top: 0, left: 0 }])
    .toBuffer();

  // 2. High-res upscale (2x to 800x608) with Lanczos3 and unsharp mask
  const outputBuf = await sharp(patched)
    .resize(800, 608, { kernel: 'lanczos3' })
    .sharpen({ sigma: 1.2, m1: 1.0, m2: 2.0 })
    .jpeg({ quality: 95 })
    .toBuffer();

  fs.writeFileSync(vashuPath, outputBuf);
  console.log('Cleaned and upscaled vashu.jpg successfully! New size:', outputBuf.length);
})();
