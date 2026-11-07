const fs = require('fs');

const indexHtml = fs.readFileSync('views/index.ejs', 'utf8');
console.log('index.ejs has rhReelModal:', indexHtml.includes('id="rhReelModal"'));
console.log('index.ejs has rh-reel-action-rail:', indexHtml.includes('rh-reel-action-rail'));
console.log('index.ejs has openRapiraReelIndex:', indexHtml.includes('openRapiraReelIndex'));
console.log('index.ejs has rapiraHomeReels:', indexHtml.includes('rapiraHomeReels'));

const css = fs.readFileSync('public/css/homepage.css', 'utf8');
console.log('homepage.css has rh-reel-action-rail:', css.includes('.rh-reel-action-rail'));
console.log('homepage.css has rh-modal-open:', css.includes('.rh-modal-open'));

const js = fs.readFileSync('public/js/homepage-motion.js', 'utf8');
console.log('homepage-motion.js has openRapiraReelIndex:', js.includes('openRapiraReelIndex'));
console.log('homepage-motion.js has rh-modal-open:', js.includes('rh-modal-open'));
console.log('homepage-motion.js has toggleReelComments:', js.includes('toggleReelComments'));

