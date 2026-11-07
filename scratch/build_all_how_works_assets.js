const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function buildCard1Vinyl() {
  const vinylPath = 'C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d\\vinyl_hires_1793350715247.jpg';
  const maskSvg = '<svg width="1024" height="1024"><circle cx="512" cy="512" r="474" fill="#fff"/></svg>';
  const maskPng = await sharp(Buffer.from(maskSvg)).png().toBuffer();

  const vinylRaw = await sharp(vinylPath).toBuffer();
  const maskedVinyl = await sharp(vinylRaw)
    .composite([{ input: maskPng, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const isolatedVinyl = await sharp(maskedVinyl)
    .resize(760, 760)
    .toBuffer();

  const base = await sharp({
    create: {
      width: 800,
      height: 800,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).png().toBuffer();

  const decorSvg = `
    <svg width="800" height="800" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
      <!-- 4-point star -->
      <path d="M 520,60 Q 520,110 570,110 Q 520,110 520,160 Q 520,110 470,110 Q 520,110 520,60 Z" fill="#B94A3E" />
      <!-- Squiggle doodle -->
      <path d="M 160,240 C 200,150 240,95 280,110 C 320,120 280,230 340,210 C 380,195 405,130 440,160" 
            fill="none" stroke="#E2B2A0" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
  const decorPng = await sharp(Buffer.from(decorSvg)).png().toBuffer();

  const outBuf = await sharp(base)
    .composite([
      { input: isolatedVinyl, top: 20, left: 40 },
      { input: decorPng, top: 0, left: 0 }
    ])
    .png({ quality: 95 })
    .toBuffer();

  fs.writeFileSync('public/images/how-it-works/card1-vinyl.png', outBuf);

  const webpBuf = await sharp(outBuf).webp({ quality: 90 }).toBuffer();
  fs.writeFileSync('public/images/how-it-works/card1-vinyl.webp', webpBuf);

  console.log('Built card1-vinyl.png & webp (800x800)');
}

async function buildCard2Crowd() {
  const crowdPath = 'C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d\\crowd_spotlight_graphic_1793350720892.jpg';
  const crowdCrop = await sharp(crowdPath)
    .extract({ left: 450, top: 0, width: 926, height: 768 })
    .resize(800, 800)
    .png()
    .toBuffer();

  const alphaMaskSvg = `
    <svg width="800" height="800" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#fff" stop-opacity="0" />
          <stop offset="22%" stop-color="#fff" stop-opacity="0.8" />
          <stop offset="45%" stop-color="#fff" stop-opacity="1" />
          <stop offset="100%" stop-color="#fff" stop-opacity="1" />
        </linearGradient>
      </defs>
      <rect width="800" height="800" fill="url(#fade)" />
    </svg>
  `;
  const alphaMask = await sharp(Buffer.from(alphaMaskSvg)).png().toBuffer();

  const outBuf = await sharp(crowdCrop)
    .composite([{ input: alphaMask, blend: 'dest-in' }])
    .png({ quality: 95 })
    .toBuffer();

  fs.writeFileSync('public/images/how-it-works/card2-crowd.png', outBuf);

  const webpBuf = await sharp(outBuf).webp({ quality: 90 }).toBuffer();
  fs.writeFileSync('public/images/how-it-works/card2-crowd.webp', webpBuf);

  console.log('Built card2-crowd.png & webp (800x800)');
}

async function buildCard3Ticket() {
  const ticketPath = 'C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d\\festival_ticket_hand_1793350810457.jpg';
  const ticketResized = await sharp(ticketPath)
    .resize(750, 1000)
    .png()
    .toBuffer();

  const alphaMaskSvg = `
    <svg width="750" height="1000" viewBox="0 0 750 1000" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#fff" stop-opacity="0" />
          <stop offset="15%" stop-color="#fff" stop-opacity="0.85" />
          <stop offset="32%" stop-color="#fff" stop-opacity="1" />
          <stop offset="100%" stop-color="#fff" stop-opacity="1" />
        </linearGradient>
      </defs>
      <rect width="750" height="1000" fill="url(#fade)" />
    </svg>
  `;
  const alphaMask = await sharp(Buffer.from(alphaMaskSvg)).png().toBuffer();

  const outBuf = await sharp(ticketResized)
    .composite([{ input: alphaMask, blend: 'dest-in' }])
    .png({ quality: 95 })
    .toBuffer();

  fs.writeFileSync('public/images/how-it-works/card3-ticket.png', outBuf);

  const webpBuf = await sharp(outBuf).webp({ quality: 90 }).toBuffer();
  fs.writeFileSync('public/images/how-it-works/card3-ticket.webp', webpBuf);

  console.log('Built card3-ticket.png & webp (750x1000)');
}

(async () => {
  await buildCard1Vinyl();
  await buildCard2Crowd();
  await buildCard3Ticket();
  console.log('Finished updating all assets!');
})();
