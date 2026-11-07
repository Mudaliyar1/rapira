const fs = require('fs');
if (fs.existsSync('public/scripts/post-viewer.js')) {
  const pv = fs.readFileSync('public/scripts/post-viewer.js', 'utf8');
  console.log('post-viewer.js length:', pv.length);
  console.log('mentions reel:', pv.includes('reel'));
  console.log('mentions rhReelModal:', pv.includes('rhReelModal'));
} else {
  console.log('post-viewer.js does not exist');
}

