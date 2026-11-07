const sharp = require('sharp');

(async () => {
  const p = 'C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d\\vinyl_hires_1793350715247.jpg';
  const meta = await sharp(p).metadata();
  console.log('p:', meta.width, meta.height);
  const maskSvg = '<svg width="1024" height="1024"><circle cx="512" cy="512" r="474" fill="#fff"/></svg>';
  const maskPng = await sharp(Buffer.from(maskSvg)).png().toBuffer();
  const maskMeta = await sharp(maskPng).metadata();
  console.log('mask:', maskMeta.width, maskMeta.height);
})();

