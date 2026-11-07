const fs = require('fs');

const p = 'views/index.ejs';
let content = fs.readFileSync(p, 'utf8');

const modalMarker = '<!-- Dedicated RAPIRA Reel Modal Viewer -->';
const markerIdx = content.indexOf(modalMarker);

if (markerIdx === -1) {
  console.error('Could not find modal marker in views/index.ejs');
  process.exit(1);
}

const newModalHtml = `<!-- Dedicated RAPIRA Reel Modal Viewer (Instagram Reels Inspired Fullscreen) -->
  <div id="rhReelModal" class="rh-reel-modal" role="dialog" aria-modal="true" aria-label="Reel Viewer" style="display: none;">
    <!-- Backdrop Click to Close (Desktop) -->
    <div class="rh-reel-modal-backdrop" onclick="window.closeRapiraReelModal()"></div>
    
    <div class="rh-reel-modal-dialog">
      <!-- Top Bar: Branding, Sound Toggle, and Accessible Close Button -->
      <div class="rh-reel-top-bar">
        <div class="rh-reel-top-left">
          <span class="rh-reel-brand-pill"><i class="bi bi-camera-reels me-1"></i> Reels</span>
          <button type="button" class="rh-reel-sound-btn" id="rhReelSoundToggle" onclick="window.toggleReelMute()" aria-label="Toggle Sound">
            <i class="bi bi-volume-up-fill" id="rhReelSoundIcon"></i>
          </button>
        </div>
        <button type="button" class="rh-reel-modal-close" onclick="window.closeRapiraReelModal()" aria-label="Close Reel">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      
      <!-- Media Stage -->
      <div class="rh-reel-stage" id="rhReelStage">
        <!-- Tap Gesture Handler Overlay (Tap to Play/Pause, Double Tap to Like) -->
        <div class="rh-reel-tap-zone" id="rhReelTapZone"></div>
        
        <!-- Big Play/Pause Center Indicator Flash -->
        <div class="rh-reel-center-feedback" id="rhReelCenterFeedback">
          <i class="bi bi-play-fill" id="rhReelFeedbackIcon"></i>
        </div>

        <!-- Big Double-Tap Heart Feedback -->
        <div class="rh-reel-doubletap-heart" id="rhReelDoubleTapHeart">
          <i class="bi bi-heart-fill"></i>
        </div>

        <!-- Loading Spinner -->
        <div id="rhReelLoading" class="rh-reel-loader">
          <div class="spinner-border text-danger" role="status">
            <span class="visually-hidden">Loading reel...</span>
          </div>
        </div>
        
        <!-- Video Player -->
        <video id="rhReelVideo" class="rh-reel-video" playsinline loop preload="auto" style="display: none;"></video>
        
        <!-- Audio Stage (For Audio-Only Reels) -->
        <div id="rhReelAudioStage" class="rh-reel-audio-stage" style="display: none;">
          <div class="rh-reel-audio-card">
            <div class="rh-reel-audio-cover-wrap">
              <img id="rhReelAudioThumb" src="/images/default-thumbnail.jpg" alt="Audio cover" class="rh-reel-audio-thumb">
              <div class="rh-audio-waveform-bars">
                <span></span><span></span><span></span><span></span><span></span>
              </div>
            </div>
            <div class="rh-audio-ctrl-wrap mt-3 w-100">
              <audio id="rhReelAudio" class="w-100" controls></audio>
            </div>
          </div>
        </div>

        <!-- Graceful Error Fallback -->
        <div id="rhReelError" class="rh-reel-error" style="display: none;">
          <i class="bi bi-exclamation-circle text-danger fs-1 mb-2"></i>
          <p class="mb-3 text-white">Media preview currently unavailable.</p>
          <a id="rhReelFallbackLink" href="/reels" class="rh-btn-outline-pill">Open in Reels Feed &rarr;</a>
        </div>

        <!-- Bottom Ambient Shadow Gradient for Text Readability -->
        <div class="rh-reel-bottom-gradient"></div>

        <!-- Bottom Left: Creator Information and Caption -->
        <div class="rh-reel-info-col">
          <div class="rh-reel-author-row mb-2">
            <a href="#" id="rhReelAuthorLink" class="text-decoration-none d-flex align-items-center gap-2">
              <img id="rhReelAuthorImg" src="/images/default-profile.svg" alt="Artist avatar" class="rh-reel-author-img">
              <span id="rhReelAuthorName" class="rh-reel-author-name">@Artist</span>
              <span id="rhReelVerifiedBadge" class="rh-verified-badge" style="display: none;">
                <i class="bi bi-patch-check-fill text-primary"></i>
              </span>
            </a>
          </div>
          
          <div class="rh-reel-caption-wrap">
            <p id="rhReelCaption" class="rh-reel-caption mb-1"></p>
            <button type="button" class="rh-reel-more-btn" id="rhReelMoreBtn" onclick="window.toggleReelCaption()" style="display: none;">more</button>
          </div>

          <div class="rh-reel-music-row">
            <i class="bi bi-music-note-beamed me-1"></i>
            <span class="rh-music-ticker" id="rhReelMusicTitle">Original Audio &bull; Rapira Music</span>
          </div>
        </div>

        <!-- Right-Side Vertical Action Rail (Instagram Reels Style) -->
        <div class="rh-reel-action-rail">
          <!-- 1. Like Button & Count -->
          <div class="rh-reel-rail-item">
            <button class="rh-reel-rail-btn" id="rhReelLikeBtn" onclick="window.toggleCurrentReelLike()" aria-label="Like Reel">
              <i class="bi bi-heart" id="rhReelLikeIcon"></i>
            </button>
            <span class="rh-reel-rail-count" id="rhReelLikeCount">0</span>
          </div>
          
          <!-- 2. Comment Button & Count -->
          <div class="rh-reel-rail-item">
            <button class="rh-reel-rail-btn" id="rhReelCommentBtn" onclick="window.toggleReelComments()" aria-label="View Comments">
              <i class="bi bi-chat-dots-fill"></i>
            </button>
            <span class="rh-reel-rail-count" id="rhReelCommentCount">0</span>
          </div>
          
          <!-- 3. Share Button & Label -->
          <div class="rh-reel-rail-item">
            <button class="rh-reel-rail-btn" onclick="window.shareCurrentReel()" aria-label="Share Reel">
              <i class="bi bi-send-fill"></i>
            </button>
            <span class="rh-reel-rail-count">Share</span>
          </div>
          
          <!-- 4. Open in Reels / More -->
          <div class="rh-reel-rail-item">
            <a class="rh-reel-rail-btn text-decoration-none" id="rhReelExternalLink" href="/reels" title="Open in full screen reels feed" aria-label="Open Full Reels Feed">
              <i class="bi bi-collection-play-fill"></i>
            </a>
            <span class="rh-reel-rail-count">Feed</span>
          </div>
        </div>

        <!-- Desktop Vertical Navigation Chevrons -->
        <div class="rh-reel-nav-controls d-none d-md-flex">
          <button type="button" class="rh-reel-vnav-btn rh-reel-vnav-prev" onclick="window.navReel(-1)" aria-label="Previous Reel">
            <i class="bi bi-chevron-up"></i>
          </button>
          <button type="button" class="rh-reel-vnav-btn rh-reel-vnav-next" onclick="window.navReel(1)" aria-label="Next Reel">
            <i class="bi bi-chevron-down"></i>
          </button>
        </div>

        <!-- In-Viewer Slide-Up Comment Drawer -->
        <div class="rh-reel-comments-drawer" id="rhReelCommentsDrawer">
          <div class="rh-comments-drawer-header">
            <h5 class="mb-0 fs-6 fw-bold text-white">Comments (<span id="rhDrawerCommentCount">0</span>)</h5>
            <button type="button" class="rh-comments-drawer-close" onclick="window.toggleReelComments()" aria-label="Close Comments">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <div class="rh-comments-drawer-body" id="rhDrawerCommentsList">
            <div class="text-center py-4 text-white-50 small">
              <i class="bi bi-chat-square-dots fs-3 d-block mb-2"></i>
              No comments yet. Start the conversation!
            </div>
          </div>
          <form class="rh-comments-drawer-footer" id="rhCommentForm" onsubmit="window.submitReelComment(event)">
            <input type="text" class="rh-comment-input" id="rhCommentInput" placeholder="Add a comment..." required autocomplete="off" />
            <button type="submit" class="rh-comment-send-btn" aria-label="Post Comment"><i class="bi bi-arrow-up-circle-fill"></i></button>
          </form>
        </div>

      </div>
    </div>
  </div>
</div>
`;

// Replace from marker to end of file
const updated = content.substring(0, markerIdx) + newModalHtml;
fs.writeFileSync(p, updated, 'utf8');
console.log('Successfully updated views/index.ejs with new Reel Modal structure!');

