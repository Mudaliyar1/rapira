const fs = require('fs');
const js = fs.readFileSync('public/js/homepage-motion.js', 'utf8');

const vm = require('vm');
const context = {
  window: {},
  document: {
    addEventListener: () => {},
    readyState: 'complete',
    querySelectorAll: () => [],
    getElementById: () => null
  },
  console: console
};
context.window = context;

try {
  vm.runInNewContext(js, context);
  console.log('Evaluated homepage-motion.js successfully!');
  console.log('openRapiraReelCard defined:', typeof context.openRapiraReelCard);
  console.log('openRapiraReelIndex defined:', typeof context.openRapiraReelIndex);
  console.log('openRapiraReel defined:', typeof context.openRapiraReel);
} catch (e) {
  console.error('Error running homepage-motion.js in vm:', e);
}

