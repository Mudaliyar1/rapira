const fs = require('fs');

// 1. Update homepage.css
const cssPath = 'public/css/homepage.css';
let css = fs.readFileSync(cssPath, 'utf8');

const toastCss = `
/* 12. Floating Non-Blocking Notice Toast */
.rh-reel-toast {
  position: fixed;
  top: 70px;
  left: 50%;
  transform: translateX(-50%) translateY(-20px);
  background: rgba(24, 24, 24, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #FFFFFF;
  font-family: 'Poppins', sans-serif;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 8px 20px;
  border-radius: 20px;
  z-index: 10000000;
  opacity: 0;
  pointer-events: none;
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.rh-reel-toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
`;

if (!css.includes('.rh-reel-toast')) {
  const marker = '/* ========================================================\n   12. EDITORIAL HOMEPAGE FOOTER';
  css = css.replace(marker, toastCss + '\n' + marker);
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('Added toast CSS to homepage.css');
}

// 2. Update homepage-motion.js
const jsPath = 'public/js/homepage-motion.js';
let js = fs.readFileSync(jsPath, 'utf8');

// Replace alerts
js = js.replace("alert('Please login to like this reel.');", "showReelNotice('Please login to like this reel.');");
js = js.replace("alert('Please login to post a comment.');", "showReelNotice('Please login to post a comment.');");
js = js.replace("alert('Reel link copied to clipboard!');", "showReelNotice('Reel link copied to clipboard!');");
js = js.replace("alert('Unable to submit comment at this time.');", "showReelNotice('Unable to submit comment at this time.');");
js = js.replace("alert('Network error while posting comment.');", "showReelNotice('Network error while posting comment.');");

// Add showReelNotice definition
const toastFunction = `
  function showReelNotice(msg) {
    let toast = document.getElementById('rhReelToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'rhReelToast';
      toast.className = 'rh-reel-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function() {
      toast.classList.remove('show');
    }, 2400);
  }
`;

if (!js.includes('function showReelNotice(')) {
  const cMarker = 'window.closeRapiraReelModal = function() {';
  js = js.replace(cMarker, toastFunction + '\n  ' + cMarker);
  fs.writeFileSync(jsPath, js, 'utf8');
  console.log('Added showReelNotice to homepage-motion.js');
}

console.log('Reel toast integration complete!');

