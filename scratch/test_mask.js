const sharp = require('sharp');

(async () => {
  const maskBuf = Buffer.from('<svg width="1024" height="1024"><circle cx="512" cy="512" r="474" fill="#fff"/></svg>');
  const meta = await sharp(maskBuf).metadata();
  console.log('Mask meta:', meta);
  
  const vinylPath = 'C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d\\vinyl_hires_1793350715247.jpg';
  const vinylBuf = await sharp(vinylPath).toBuffer();
  
  // Cut with dest-in
  const masked = await sharp(vinylBuf)
    .composite([{ input: await sharp(maskBuf).png().toBuffer(), blend: 'dest-in' }])
    .png()
    .toBuffer();
  console.log('Masked success! size:', masked.length);
})();

