const fs = require('fs');

const p = 'views/index.ejs';
let content = fs.readFileSync(p, 'utf8');

// 1. Update onclick in real reels loop
const oldRealOnclick = `onclick="window.openRapiraReel('<%= reel._id %>', '<%= mediaUrl %>', '<%= mediaType %>', '<%= reelArtistName %>', '<%= reelArtistImg %>', '<%= posterUrl %>', '<%= safeCaption %>')"`;
const newRealOnclick = `onclick="window.openRapiraReelIndex ? window.openRapiraReelIndex(<%= index %>) : window.openRapiraReel('<%= reel._id %>', '<%= mediaUrl %>', '<%= mediaType %>', '<%= reelArtistName %>', '<%= reelArtistImg %>', '<%= posterUrl %>', '<%= safeCaption %>')"`;

if (content.includes(oldRealOnclick)) {
  content = content.replace(oldRealOnclick, newRealOnclick);
  console.log('Updated real reels onclick');
}

// 2. Update onkeydown in real reels loop
const oldRealKeydown = `onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.openRapiraReel('<%= reel._id %>', '<%= mediaUrl %>', '<%= mediaType %>', '<%= reelArtistName %>', '<%= reelArtistImg %>', '<%= posterUrl %>', '<%= safeCaption %>');}"`;
const newRealKeydown = `onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.openRapiraReelIndex ? window.openRapiraReelIndex(<%= index %>) : window.openRapiraReel('<%= reel._id %>', '<%= mediaUrl %>', '<%= mediaType %>', '<%= reelArtistName %>', '<%= reelArtistImg %>', '<%= posterUrl %>', '<%= safeCaption %>');}"`;

if (content.includes(oldRealKeydown)) {
  content = content.replace(oldRealKeydown, newRealKeydown);
  console.log('Updated real reels onkeydown');
}

// 3. Update mock reels onclick
const oldMockOnclick = `onclick="window.openRapiraReel('mock-<%= idx %>', '<%= mReel.video %>', 'video', '<%= mReel.artist %>', '/images/default-profile.svg', '<%= mReel.img %>', 'Rapira festival reel')"`;
const newMockOnclick = `onclick="window.openRapiraReelIndex ? window.openRapiraReelIndex(<%= idx %>) : window.openRapiraReel('mock-<%= idx %>', '<%= mReel.video %>', 'video', '<%= mReel.artist %>', '/images/default-profile.svg', '<%= mReel.img %>', 'Rapira festival reel')"`;

if (content.includes(oldMockOnclick)) {
  content = content.replace(oldMockOnclick, newMockOnclick);
  console.log('Updated mock reels onclick');
}

// 4. Update mock reels onkeydown
const oldMockKeydown = `onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.openRapiraReel('mock-<%= idx %>', '<%= mReel.video %>', 'video', '<%= mReel.artist %>', '/images/default-profile.svg', '<%= mReel.img %>', 'Rapira festival reel');}"`;
const newMockKeydown = `onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.openRapiraReelIndex ? window.openRapiraReelIndex(<%= idx %>) : window.openRapiraReel('mock-<%= idx %>', '<%= mReel.video %>', 'video', '<%= mReel.artist %>', '/images/default-profile.svg', '<%= mReel.img %>', 'Rapira festival reel');}"`;

if (content.includes(oldMockKeydown)) {
  content = content.replace(oldMockKeydown, newMockKeydown);
  console.log('Updated mock reels onkeydown');
}

// 5. Replace modal markup
const modalMarker = '<!-- Dedicated RAPIRA Reel Modal Viewer';
const markerIdx = content.indexOf(modalMarker);
if (markerIdx === -1) {
  console.error('Modal marker not found!');
  process.exit(1);
}

const newModalMarkup = `<!-- Dedicated RAPIRA Reel Modal Viewer (Instagram Reels Inspired Fullscreen) -->
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

  <!-- Client-Side Reels Array Injection for Smooth In-Viewer Navigation -->
  <script>
    window.rapiraHomeReels = <%- JSON.stringify(typeof homeReels !== 'undefined' && homeReels && homeReels.length > 0 ? homeReels : [
      { _id: 'mock-0', media: { url: 'https://res.cloudinary.com/dlbwyl1ci/video/upload/v1771783781/rapira/artist-posts/videos/file_i4o4zn.mp4', mediaType: 'video', thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80' }, artist: { stageName: 'Riona', profileImage: '/images/default-profile.svg', verified: true }, caption: 'Live energy at Rapira Sunburn Stage! 🔥', likesCount: 1420, commentsCount: 38 },
      { _id: 'mock-1', media: { url: 'https://res.cloudinary.com/dlbwyl1ci/video/upload/v1772370075/rapira/artist-posts/videos/file_lueitr.mp4', mediaType: 'video', thumbnailUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=400&q=80' }, artist: { stageName: 'Riona', profileImage: '/images/default-profile.svg', verified: true }, caption: 'Bass drop that shook the festival grounds. Unforgettable night! ⚡', likesCount: 890, commentsCount: 24 },
      { _id: 'mock-2', media: { url: 'https://res.cloudinary.com/dlbwyl1ci/video/upload/v1772882951/rapira/artist-posts/videos/file_jgs8ey.mp4', mediaType: 'video', thumbnailUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=400&q=80' }, artist: { stageName: 'Riona', profileImage: '/images/default-profile.svg', verified: true }, caption: 'Mumbai hip-hop cypher backstage vibes 🎤', likesCount: 2310, commentsCount: 76 },
      { _id: 'mock-3', media: { url: 'https://res.cloudinary.com/dlbwyl1ci/video/upload/v1772883353/rapira/artist-posts/videos/file_rhulqk.mp4', mediaType: 'video', thumbnailUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=400&q=80' }, artist: { stageName: 'Riona', profileImage: '/images/default-profile.svg', verified: true }, caption: 'Exclusive acoustic freestyle before going live 🎸', likesCount: 654, commentsCount: 19 },
      { _id: 'mock-4', media: { url: 'https://res.cloudinary.com/dlbwyl1ci/video/upload/v1773255019/rapira/artist-posts/videos/file_kdchpp.mp4', mediaType: 'video', thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80' }, artist: { stageName: 'Riona', profileImage: '/images/default-profile.svg', verified: true }, caption: 'Underground beats and crowd synchronization ✨', likesCount: 1120, commentsCount: 42 },
      { _id: 'mock-5', media: { url: 'https://res.cloudinary.com/dlbwyl1ci/video/upload/v1771783781/rapira/artist-posts/videos/file_i4o4zn.mp4', mediaType: 'video', thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80' }, artist: { stageName: 'Riona', profileImage: '/images/default-profile.svg', verified: true }, caption: 'Festival season never sleeps in India! 🚀', likesCount: 1780, commentsCount: 51 }
    ]) %>;
  </script>
</div>
`;

content = content.substring(0, markerIdx) + newModalMarkup;
fs.writeFileSync(p, content, 'utf8');
console.log('views/index.ejs successfully updated!');

