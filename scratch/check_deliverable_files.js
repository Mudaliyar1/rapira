const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\abc\\.gemini\\antigravity\\brain\\97005936-a5e5-495e-bea8-18c87a610b4d';
const files = [
  'mobile-fullscreen-reel-viewer.png',
  'desktop-reel-viewer.png',
  'reel-action-rail.png',
  'reel-comments-drawer.png',
  'reel-closed-navbar-restored.png'
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

