const fs = require('fs');

const p = 'public/css/homepage.css';
let css = fs.readFileSync(p, 'utf8');

const s11Marker = '/* ========================================================\n   11. DEDICATED RAPIRA REEL VIEWER MODAL\n   ======================================================== */';
const s12Marker = '/* ========================================================\n   12. EDITORIAL HOMEPAGE FOOTER (WARM CREAM PALETTE)\n   ======================================================== */';

const startIdx = css.indexOf(s11Marker);
const endIdx = css.indexOf(s12Marker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Markers not found! startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

const newS11Css = `/* ========================================================
   11. DEDICATED RAPIRA REEL VIEWER MODAL (INSTAGRAM REELS-INSPIRED)
   ======================================================== */

/* 1. Prevent background scrolling and hide navbar/chat widgets when reel is active */
body.rh-modal-open {
  overflow: hidden !important;
  touch-action: none;
}

body.rh-modal-open .navbar,
body.rh-modal-open .navbar-glass,
body.rh-modal-open #websiteUpdateBanner,
body.rh-modal-open .chatbot-toggle,
body.rh-modal-open .chatbot-container,
body.rh-modal-open .floating-social-share,
body.rh-modal-open .rh-back-to-top {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

/* 2. Fullscreen Immersive Modal Container */
.rh-reel-modal {
  position: fixed;
  inset: 0;
  z-index: 9999999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.94);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  padding: 0;
  margin: 0;
  box-sizing: border-box;
}

/* Desktop Backdrop click area */
.rh-reel-modal-backdrop {
  position: absolute;
  inset: 0;
  cursor: pointer;
  z-index: 1;
}

/* 3. Modal Dialog Stage Frame (Desktop 9:16 Portrait / Mobile 100dvh) */
.rh-reel-modal-dialog {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 430px;
  height: min(92vh, 860px);
  aspect-ratio: 9 / 16;
  background: #0A0A0A;
  border-radius: 22px;
  overflow: hidden;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
}

/* 4. Top Bar: Branding Pill, Sound Toggle, and Accessible Close Button */
.rh-reel-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 35;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(14px + env(safe-area-inset-top, 0px)) 16px 14px 16px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 65%, transparent 100%);
  pointer-events: none;
}

.rh-reel-top-left {
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}

.rh-reel-brand-pill {
  display: inline-flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #FFFFFF;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  font-family: 'Poppins', sans-serif;
}

.rh-reel-sound-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.rh-reel-sound-btn:hover {
  background: var(--rh-crimson, #9F190E);
  border-color: var(--rh-crimson, #9F190E);
  transform: scale(1.08);
}

.rh-reel-modal-close {
  pointer-events: auto;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.rh-reel-modal-close:hover,
.rh-reel-modal-close:focus-visible {
  background: var(--rh-crimson, #9F190E);
  border-color: var(--rh-crimson, #9F190E);
  transform: scale(1.08);
  outline: none;
}

/* 5. Media Stage */
.rh-reel-stage {
  position: relative;
  width: 100%;
  height: 100%;
  flex: 1;
  background: #000000;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Tap Overlay for gestures */
.rh-reel-tap-zone {
  position: absolute;
  inset: 0;
  z-index: 15;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/* Center Feedback Flash (Play/Pause) */
.rh-reel-center-feedback {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.6);
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  z-index: 25;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

.rh-reel-center-feedback.show {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

/* Double-Tap Heart Feedback */
.rh-reel-doubletap-heart {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  color: #FF2B54;
  font-size: 4.8rem;
  z-index: 26;
  pointer-events: none;
  filter: drop-shadow(0 4px 18px rgba(255, 43, 84, 0.7));
}

.rh-reel-doubletap-heart.pop {
  animation: rhHeartPop 0.8s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
}

@keyframes rhHeartPop {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
  30% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(0.95); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
}

/* Loading Spinner */
.rh-reel-loader {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000000;
  z-index: 10;
}

/* Video Player */
.rh-reel-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #000000;
  display: block;
}

/* Audio Stage */
.rh-reel-audio-stage {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #160607 0%, #2A0E11 50%, #100405 100%);
  padding: 2rem;
  z-index: 5;
}

.rh-reel-audio-card {
  width: 100%;
  max-width: 320px;
  text-align: center;
}

.rh-reel-audio-cover-wrap {
  width: 180px;
  height: 180px;
  margin: 0 auto;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 12px 32px rgba(159, 25, 14, 0.35);
  border: 1px solid rgba(234, 200, 183, 0.3);
}

.rh-reel-audio-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rh-audio-waveform-bars {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
}

.rh-audio-waveform-bars span {
  width: 4px;
  height: 20px;
  background: #FFFFFF;
  border-radius: 2px;
  animation: rhAudioBar 1s infinite alternate;
}

.rh-audio-waveform-bars span:nth-child(2) { animation-delay: 0.2s; height: 32px; }
.rh-audio-waveform-bars span:nth-child(3) { animation-delay: 0.4s; height: 26px; }
.rh-audio-waveform-bars span:nth-child(4) { animation-delay: 0.1s; height: 28px; }
.rh-audio-waveform-bars span:nth-child(5) { animation-delay: 0.3s; height: 16px; }

@keyframes rhAudioBar {
  from { transform: scaleY(0.3); }
  to { transform: scaleY(1); }
}

/* Error Fallback */
.rh-reel-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #0A0A0A;
  z-index: 12;
  padding: 2rem;
  text-align: center;
}

/* 6. Bottom Ambient Gradient Behind Creator and Caption */
.rh-reel-bottom-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 55%;
  background: linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.12) 75%, transparent 100%);
  pointer-events: none;
  z-index: 18;
}

/* 7. Lower-Left: Creator Information and Caption */
.rh-reel-info-col {
  position: absolute;
  left: 16px;
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  max-width: calc(100% - 88px);
  z-index: 25;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}

.rh-reel-author-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rh-reel-author-img {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1.8px solid #FFFFFF;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
}

.rh-reel-author-name {
  color: #FFFFFF;
  font-family: 'Poppins', sans-serif;
  font-size: 0.92rem;
  font-weight: 700;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
}

.rh-verified-badge {
  font-size: 0.95rem;
  color: #3897F0;
  display: inline-flex;
  align-items: center;
}

.rh-reel-caption-wrap {
  position: relative;
  max-width: 100%;
}

.rh-reel-caption {
  color: rgba(255, 255, 255, 0.94);
  font-family: 'Poppins', sans-serif;
  font-size: 0.84rem;
  line-height: 1.35;
  margin: 0;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.rh-reel-caption.expanded {
  -webkit-line-clamp: unset !important;
  max-height: 180px;
  overflow-y: auto;
}

.rh-reel-more-btn {
  background: none;
  border: none;
  padding: 0;
  color: rgba(255, 255, 255, 0.75);
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  margin-top: 2px;
}

.rh-reel-music-row {
  display: flex;
  align-items: center;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.78rem;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
  font-weight: 500;
  gap: 6px;
}

.rh-music-ticker {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

/* 8. Right-Side Vertical Action Rail (Instagram Reels Style) */
.rh-reel-action-rail {
  position: absolute;
  right: 14px;
  bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  z-index: 28;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  pointer-events: auto;
}

.rh-reel-rail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.rh-reel-rail-btn {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.22);
  border: none;
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.55rem;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28), color 0.2s ease, background 0.2s ease;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.75));
  -webkit-tap-highlight-color: transparent;
  padding: 0;
}

.rh-reel-rail-btn:hover {
  transform: scale(1.15);
  background: rgba(0, 0, 0, 0.45);
  color: #FFFFFF;
}

.rh-reel-rail-btn:active {
  transform: scale(0.92);
}

.rh-reel-rail-count {
  color: #FFFFFF;
  font-family: 'Poppins', sans-serif;
  font-size: 0.76rem;
  font-weight: 600;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
  user-select: none;
}

.rh-reel-rail-btn .bi-heart-fill {
  color: #FF2B54;
}

/* 9. Desktop Vertical Navigation Chevrons */
.rh-reel-nav-controls {
  position: absolute;
  right: -60px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 14px;
  z-index: 30;
}

.rh-reel-vnav-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(20, 20, 20, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.rh-reel-vnav-btn:hover {
  background: var(--rh-crimson, #9F190E);
  border-color: var(--rh-crimson, #9F190E);
  transform: scale(1.1);
}

/* 10. In-Viewer Slide-Up Comment Drawer */
.rh-reel-comments-drawer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 62%;
  background: #141414;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.85);
  z-index: 45;
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
}

.rh-reel-comments-drawer.active {
  transform: translateY(0);
}

.rh-comments-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.rh-comments-drawer-close {
  background: none;
  border: none;
  color: #FFFFFF;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s ease;
}

.rh-comments-drawer-close:hover {
  opacity: 0.7;
}

.rh-comments-drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.rh-comment-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.rh-comment-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.rh-comment-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rh-comment-user {
  color: #FFFFFF;
  font-size: 0.82rem;
  font-weight: 700;
  font-family: 'Poppins', sans-serif;
}

.rh-comment-text {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.82rem;
  line-height: 1.35;
  margin: 0;
}

.rh-comment-time {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.72rem;
}

.rh-comments-drawer-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: #181818;
}

.rh-comment-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  padding: 8px 14px;
  color: #FFFFFF;
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.rh-comment-input:focus {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.12);
}

.rh-comment-send-btn {
  background: none;
  border: none;
  color: #FF2B54;
  font-size: 1.6rem;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
}

.rh-comment-send-btn:hover {
  transform: scale(1.1);
}

/* 11. Mobile Responsive Override (Primary Viewport Target) */
@media (max-width: 767.98px) {
  .rh-reel-modal {
    padding: 0;
    background: #000000;
  }
  
  .rh-reel-modal-dialog {
    width: 100vw;
    max-width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
    border: none;
    box-shadow: none;
    aspect-ratio: auto;
  }
  
  .rh-reel-nav-controls {
    display: none !important;
  }
  
  .rh-reel-action-rail {
    right: 12px;
    bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    gap: 14px;
  }
  
  .rh-reel-rail-btn {
    width: 44px;
    height: 44px;
    font-size: 1.45rem;
  }
  
  .rh-reel-info-col {
    left: 14px;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    max-width: calc(100% - 78px);
  }
  
  .rh-reel-caption {
    font-size: 0.82rem;
  }
  
  .rh-reel-comments-drawer {
    height: 68%;
  }
}

`;

const updatedCss = css.substring(0, startIdx) + newS11Css + css.substring(endIdx);
fs.writeFileSync(p, updatedCss, 'utf8');
console.log('Successfully updated Section 11 in public/css/homepage.css!');

