const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

(async () => {
  const vinylPath = 'C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d\\vinyl_hires_1793350715247.jpg';
  
  // 1. Clean circular cut of the vinyl (1024x1024)
  const circleMaskSvg = `
    <svg width="1024" height="1024" viewBox="0 0 1024 1024">
      <circle cx="512" cy="512" r="474" fill="#ffffff" />
    </svg>
  `;
  
  const isolatedVinyl = await sharp(vinylPath)
    .ensureAlpha()
    .composite([{ input: Buffer.from(circleMaskSvg), blend: 'dest-in' }])
    .resize(650, 650)
    .png()
    .toBuffer();

  // 2. Base canvas with alpha transparency (800 x 800)
  const baseCanvas = await sharp({
    create: {
      width: 800,
      height: 800,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).png().toBuffer();

  // 3. Decorative Star & Squiggle SVG (drawn crisp, in front/around vinyl)
  const decorativeSvg = `
    <svg width="800" height="800" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
      <!-- Terracotta 4-point sparkle star in upper right -->
      <path d="M 600,60 Q 600,110 650,110 Q 600,110 600,160 Q 600,110 550,110 Q 600,110 600,60 Z" 
            fill="#B94A3E" />
      
      <!-- Organic squiggle doodle in upper area -->
      <path d="M 220,240 C 260,150 300,100 340,110 C 380,120 340,230 400,210 C 440,195 460,130 500,160" 
            fill="none" stroke="#E2B2A0" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;

  // Place vinyl on right/center (top: 100, left: 150), and decorations on top
  await sharp(baseCanvas)
    .composite([
      { input: isolatedVinyl, top: 100, left: 150 },
      { input: Buffer.from(decorativeSvg), top: 0, left: 0 }
    ])
    .png()
    .toFile('public/images/how-it-works/card1-vinyl.png');

  console.log('Saved card1-vinyl.png successfully!');
})();
