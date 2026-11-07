const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d';
const files = [
  'titan-one-desktop-homepage.png',
  'titan-one-hero-detail.png',
  'titan-one-how-rapira-works.png',
  'titan-one-section-headings.png',
  'titan-one-mobile-homepage.png'
];

files.forEach(f => {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) {
    const stat = fs.statSync(p);
    console.log(`${f}: ${stat.size} bytes`);
  } else {
    console.log(`${f}: MISSING`);
  }
});

