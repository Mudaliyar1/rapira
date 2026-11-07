// Post Viewer Modal Script
let currentPost = null;
let currentUserId = null;

// Format time ago
function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// Stop all audio/video playback
function stopMediaPlayback() {
  const mediaContainer = document.getElementById('post-media-container');
  if (mediaContainer) {
    // Stop all audio and video elements
    const audios = mediaContainer.querySelectorAll('audio');
    const videos = mediaContainer.querySelectorAll('video');

    audios.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });

    videos.forEach(video => {
      video.pause();
      video.currentTime = 0;
    });

    console.log('[POST VIEWER] Media playback stopped');
  }
}

// Open post in modal
async function viewPost(postId) {
  try {
    console.log('[POST VIEWER] Loading post:', postId);

    // Show modal immediately with loading state
    const modalElement = document.getElementById('post-viewer');
    if (modalElement) {
      // Clear previous content and show loading state
      const mediaContainer = document.getElementById('post-media-container');
      const captionElement = document.getElementById('post-caption');
      const hashtagsContainer = document.getElementById('post-hashtags');
      const likesElement = document.getElementById('post-likes-count');
      const sharesElement = document.getElementById('post-shares-count');

      if (mediaContainer) mediaContainer.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></div>';
      if (captionElement) captionElement.textContent = '';
      if (hashtagsContainer) hashtagsContainer.innerHTML = '';
      if (likesElement) likesElement.textContent = '0';
      if (sharesElement) sharesElement.textContent = '0';
      const commentsElement = document.getElementById('post-comments-count');
      const reportsElement = document.getElementById('post-reports-count');
      if (commentsElement) commentsElement.textContent = '0';
      if (reportsElement) reportsElement.textContent = '0';

      // Update like button to default state
      updateLikeButton(false);

      // Show modal immediately
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }

    // Fetch post data
    const res = await fetch(`/posts/${postId}/json?_ts=${Date.now()}`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('Failed to load post');

    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to load post');

    currentPost = data.post;
    console.log('[POST VIEWER] Post loaded:', currentPost);

    // Populate modal
    const artistLink = document.getElementById('post-artist-link');
    const artistImg = document.getElementById('post-artist-img');
    const artistProfileUrl = `/artists/${currentPost.artist._id}`;

    const stageName = currentPost.artist.stageName || 'Artist';
    const profileImg = currentPost.artist.profileImage || '/images/default-profile.svg';
    const timeAgo = formatTimeAgo(currentPost.createdAt);

    if (document.getElementById('post-artist-name')) {
      document.getElementById('post-artist-name').textContent = stageName;
    }
    if (artistLink) artistLink.href = artistProfileUrl;
    if (artistImg) {
      artistImg.src = profileImg;
      artistImg.style.cursor = 'pointer';
      artistImg.onclick = () => window.location.href = artistProfileUrl;
    }

    // Populate mobile header elements if present
    const mobileArtistName = document.getElementById('post-artist-name-mobile');
    const mobileArtistLink = document.getElementById('post-artist-link-mobile');
    const mobileArtistImg = document.getElementById('post-artist-img-mobile');
    const mobileCreatedAt = document.getElementById('post-created-at-mobile');
    if (mobileArtistName) mobileArtistName.textContent = stageName;
    if (mobileArtistLink) mobileArtistLink.href = artistProfileUrl;
    if (mobileArtistImg) {
      mobileArtistImg.src = profileImg;
      mobileArtistImg.onclick = () => window.location.href = artistProfileUrl;
    }
    if (mobileCreatedAt) mobileCreatedAt.textContent = timeAgo;

    if (document.getElementById('post-created-at')) {
      document.getElementById('post-created-at').textContent = timeAgo;
    }
    document.getElementById('post-likes-count').textContent = currentPost.likesDisplay || currentPost.fakeLikesLabel || currentPost.likesCount || 0;
    document.getElementById('post-shares-count').textContent = currentPost.shares || 0;
    document.getElementById('post-views-count').textContent = currentPost.fakeViewsLabel || currentPost.viewsDisplay || currentPost.views || 0;
    document.getElementById('post-comments-count').textContent = (currentPost.comments || []).length;
    document.getElementById('post-reports-count').textContent = (currentPost.reports || []).length;

    // Handle caption with Read More
    const caption = currentPost.caption || '';
    const captionElement = document.getElementById('post-caption');
    const readMoreBtn = document.getElementById('read-more-btn');

    // Split caption into words
    const words = caption.trim().split(/\s+/);
    const WORD_LIMIT = 25; // Show first 25 words

    console.log('[POST VIEWER] Caption has', words.length, 'words');
    console.log('[POST VIEWER] Hashtags array:', currentPost.hashtags);

    if (words.length > WORD_LIMIT) {
      // Caption is long - show truncated version
      const truncated = words.slice(0, WORD_LIMIT).join(' ') + '...';
      captionElement.textContent = truncated;
      captionElement.dataset.fullText = caption;
      captionElement.dataset.truncatedText = truncated;
      captionElement.dataset.isExpanded = 'false';
      readMoreBtn.style.display = 'inline-block';
      readMoreBtn.textContent = 'Read More';
      console.log('[POST VIEWER] Truncated caption, showing Read More');
    } else {
      // Caption is short - show full text, no button
      captionElement.textContent = caption;
      captionElement.dataset.isExpanded = 'true';
      readMoreBtn.style.display = 'none';
      console.log('[POST VIEWER] Short caption, no truncation');
    }

    // Populate hashtags ONLY if they are NOT already in the caption
    const hashtagsContainer = document.getElementById('post-hashtags');
    hashtagsContainer.innerHTML = '';

    // Check if caption contains hashtags
    const captionHasHashtags = caption.includes('#');

    if (!captionHasHashtags && currentPost.hashtags && currentPost.hashtags.length > 0) {
      // Only show hashtags section if caption doesn't have hashtags
      currentPost.hashtags.forEach(tag => {
        const span = document.createElement('span');
        span.textContent = tag.startsWith('#') ? tag : `#${tag}`;
        span.style.color = '#9F190E';
        span.style.fontSize = '0.85rem';
        span.style.fontWeight = '600';
        span.style.background = '#FCF0E4';
        span.style.border = '1px solid #EAC8B7';
        span.style.borderRadius = '999px';
        span.style.padding = '3px 10px';
        span.style.marginRight = '6px';
        span.style.marginBottom = '6px';
        span.style.display = 'inline-block';
        hashtagsContainer.appendChild(span);
      });
      console.log('[POST VIEWER] Showing separate hashtags section');
    } else {
      console.log('[POST VIEWER] Hashtags already in caption, hiding separate section');
      hashtagsContainer.style.display = 'none';
    }

    // Populate media
    const mediaContainer = document.getElementById('post-media-container');
    mediaContainer.innerHTML = '';

    // Robust audio detection: check mediaType OR file extension OR Cloudinary folder
    const mediaUrl = (currentPost.media.url || '').toLowerCase();
    const isAudioFile = mediaUrl.endsWith('.mp3') ||
      mediaUrl.endsWith('.wav') ||
      mediaUrl.endsWith('.ogg') ||
      mediaUrl.endsWith('.m4a') ||
      mediaUrl.endsWith('.aac') ||
      mediaUrl.includes('/artist-posts/audio/');

    const isAudio = currentPost.media.mediaType === 'audio' || isAudioFile;

    console.log('[POST VIEWER] Media Detection:', {
      type: currentPost.media.mediaType,
      url: mediaUrl,
      isAudioDetected: isAudio
    });

    if (isAudio) {
      // AUDIO BLOCK - (Show animated visualizer in Rapira Crimson & Cream)
      const audioContainer = document.createElement('div');
      audioContainer.className = 'audio-visualizer-modal';
      audioContainer.style.cssText = 'width: 100%; min-height: 380px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 20px; position: relative; overflow: hidden; background: linear-gradient(135deg, #181413 0%, #2A1D1A 100%);';

      const audioThumbnailUrl = (currentPost.media && currentPost.media.thumbnailUrl) ? currentPost.media.thumbnailUrl : '';
      const hasAudioThumbnail = !!audioThumbnailUrl;

      if (hasAudioThumbnail) {
        audioContainer.style.cssText = 'width: 100%; min-height: 380px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 20px; padding: 20px; position: relative; overflow: hidden; background: #181413;';
        const cover = document.createElement('img');
        cover.src = audioThumbnailUrl;
        cover.alt = 'Audio thumbnail';
        cover.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1; filter: drop-shadow(0 4px 16px rgba(0,0,0,0.4));';
        cover.onerror = function () { this.onerror = null; this.src = '/images/default-thumbnail.jpg'; };
        audioContainer.appendChild(cover);
      }

      // Inline SVG Visualizer in Rapira Crimson & Peach
      const svgHtml = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 10px rgba(159, 25, 14, 0.5));">
          <rect x="10" y="40" width="12" height="40" rx="6" fill="#9F190E">
            <animate attributeName="height" values="20;80;20" dur="1s" repeatCount="indefinite" />
            <animate attributeName="y" values="50;20;50" dur="1s" repeatCount="indefinite" />
          </rect>
          <rect x="35" y="40" width="12" height="40" rx="6" fill="#C43224">
            <animate attributeName="height" values="30;100;30" dur="0.8s" repeatCount="indefinite" />
            <animate attributeName="y" values="45;10;45" dur="0.8s" repeatCount="indefinite" />
          </rect>
          <rect x="60" y="40" width="12" height="40" rx="6" fill="#EAC8B7">
            <animate attributeName="height" values="25;90;25" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="y" values="47.5;15;47.5" dur="1.2s" repeatCount="indefinite" />
          </rect>
          <rect x="85" y="40" width="12" height="40" rx="6" fill="#9F190E">
            <animate attributeName="height" values="40;110;40" dur="0.7s" repeatCount="indefinite" />
            <animate attributeName="y" values="40;5;40" dur="0.7s" repeatCount="indefinite" />
          </rect>
          <rect x="110" y="40" width="12" height="40" rx="6" fill="#EAC8B7">
            <animate attributeName="height" values="20;70;20" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="y" values="50;25;50" dur="1.5s" repeatCount="indefinite" />
          </rect>
          <rect x="135" y="40" width="12" height="40" rx="6" fill="#C43224">
            <animate attributeName="height" values="35;95;35" dur="0.9s" repeatCount="indefinite" />
            <animate attributeName="y" values="42.5;12.5;42.5" dur="0.9s" repeatCount="indefinite" />
          </rect>
          <rect x="160" y="40" width="12" height="40" rx="6" fill="#EAC8B7">
            <animate attributeName="height" values="25;85;25" dur="1.1s" repeatCount="indefinite" />
            <animate attributeName="y" values="47.5;17.5;47.5" dur="1.1s" repeatCount="indefinite" />
          </rect>
          <rect x="185" y="40" width="12" height="40" rx="6" fill="#9F190E">
            <animate attributeName="height" values="30;105;30" dur="0.75s" repeatCount="indefinite" />
            <animate attributeName="y" values="45;7.5;45" dur="0.75s" repeatCount="indefinite" />
          </rect>
          <rect x="210" y="40" width="12" height="40" rx="6" fill="#C43224">
            <animate attributeName="height" values="20;100;20" dur="1.3s" repeatCount="indefinite" />
            <animate attributeName="y" values="50;10;50" dur="1.3s" repeatCount="indefinite" />
          </rect>
          <text x="50%" y="120" text-anchor="middle" fill="rgba(234, 200, 183, 0.7)" font-size="10" font-weight="bold" letter-spacing="3" style="text-transform: uppercase;">RAPIRA MUSIC</text>
        </svg>
      `;

      if (!hasAudioThumbnail) {
        const vizContainer = document.createElement('div');
        vizContainer.innerHTML = svgHtml;
        audioContainer.appendChild(vizContainer);
      }

      // Audio element (hidden, no unexpected autoplay)
      const audio = document.createElement('audio');
      audio.src = currentPost.media.url;
      audio.preload = 'metadata';
      audio.style.cssText = 'display: none;';
      audioContainer.appendChild(audio);

      // Minimal player container (Rapira Cream & Crimson style)
      const playerContainer = document.createElement('div');
      playerContainer.style.cssText = hasAudioThumbnail
        ? 'display: flex; align-items: center; gap: 12px; width: calc(100% - 24px); max-width: 640px; background: rgba(255, 253, 248, 0.94); padding: 10px 16px; border-radius: 9999px; border: 1.5px solid #EAC8B7; backdrop-filter: blur(12px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); z-index: 12; position: absolute; left: 12px; right: 12px; bottom: 12px;'
        : 'display: flex; align-items: center; gap: 14px; width: 100%; max-width: 480px; background: #FFFDF8; padding: 12px 20px; border-radius: 9999px; border: 1.5px solid #EAC8B7; box-shadow: 0 8px 24px rgba(159, 25, 14, 0.08); z-index: 10;';

      // Play/Pause button - circular crimson (starts with Play icon)
      const playBtn = document.createElement('button');
      playBtn.setAttribute('type', 'button');
      playBtn.setAttribute('aria-label', 'Play audio');
      playBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
      playBtn.style.cssText = 'background: #9F190E; border: none; color: #FFFFFF; cursor: pointer; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; flex-shrink: 0; font-size: 1.35rem; box-shadow: 0 4px 12px rgba(159, 25, 14, 0.35);';

      playBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (audio.paused) {
          audio.play().catch(err => {
            console.warn('[POST VIEWER] Audio play error:', err);
            showToast('Unable to start audio playback', 'error');
          });
        } else {
          audio.pause();
        }
      });

      audio.addEventListener('play', () => {
        playBtn.innerHTML = '<i class="bi bi-pause-fill"></i>';
        playBtn.setAttribute('aria-label', 'Pause audio');
      });
      audio.addEventListener('pause', () => {
        playBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
        playBtn.setAttribute('aria-label', 'Play audio');
      });
      audio.addEventListener('ended', () => {
        playBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
        playBtn.setAttribute('aria-label', 'Play audio');
        audio.currentTime = 0;
        if (progress) progress.style.width = '0%';
        if (currentTimeSpan) currentTimeSpan.textContent = '0:00';
      });

      playerContainer.appendChild(playBtn);

      // Progress bar container
      const progressWrapper = document.createElement('div');
      progressWrapper.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 4px;';

      // Progress bar
      const progressBar = document.createElement('div');
      progressBar.style.cssText = 'height: 6px; background: #EAC8B7; border-radius: 999px; cursor: pointer; position: relative; overflow: hidden;';

      const progress = document.createElement('div');
      progress.style.cssText = 'height: 100%; background: #9F190E; border-radius: 999px; width: 0%; transition: width 0.1s linear;';
      progressBar.appendChild(progress);

      audio.addEventListener('timeupdate', () => {
        if (audio.duration && !isNaN(audio.duration)) {
          const percent = (audio.currentTime / audio.duration) * 100;
          progress.style.width = percent + '%';
        }
        currentTimeSpan.textContent = formatT(audio.currentTime);
      });

      progressBar.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!audio.duration || isNaN(audio.duration) || !isFinite(audio.duration)) return;
        const rect = progressBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audio.currentTime = percent * audio.duration;
        progress.style.width = (percent * 100) + '%';
        currentTimeSpan.textContent = formatT(audio.currentTime);
      });

      progressWrapper.appendChild(progressBar);

      // Time display
      const timeDisplay = document.createElement('div');
      timeDisplay.style.cssText = 'display: flex; justify-content: space-between; color: #7A6F68; font-size: 0.75rem; font-family: "Poppins", sans-serif; font-weight: 600;';

      const currentTimeSpan = document.createElement('span');
      currentTimeSpan.textContent = '0:00';
      const durationSpan = document.createElement('span');
      durationSpan.textContent = '0:00';

      timeDisplay.appendChild(currentTimeSpan);
      timeDisplay.appendChild(durationSpan);

      const formatT = (s) => {
        if (isNaN(s) || !isFinite(s) || s < 0) return '0:00';
        const m = Math.floor(s / 60);
        const sc = Math.floor(s % 60);
        return m + ':' + (sc < 10 ? '0' : '') + sc;
      };

      const updateDuration = () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          durationSpan.textContent = formatT(audio.duration);
        }
      };

      audio.addEventListener('loadedmetadata', updateDuration);
      audio.addEventListener('durationchange', updateDuration);
      audio.addEventListener('canplay', updateDuration);
      audio.addEventListener('error', (e) => {
        console.warn('[POST VIEWER] Audio source error:', e);
        durationSpan.textContent = '--:--';
      });

      progressWrapper.appendChild(timeDisplay);
      playerContainer.appendChild(progressWrapper);

      // Volume control
      const volIcon = document.createElement('i');
      volIcon.className = 'bi bi-volume-up ms-2';
      volIcon.style.cssText = 'color: #9F190E; opacity: 0.85; cursor: pointer; font-size: 1.1rem;';
      volIcon.setAttribute('title', 'Mute / Unmute');

      const volSlider = document.createElement('input');
      volSlider.type = 'range';
      volSlider.min = '0';
      volSlider.max = '100';
      volSlider.value = '80';
      audio.volume = 0.8;
      let prevVolume = 0.8;
      volSlider.style.cssText = 'width: 64px; height: 5px; cursor: pointer; -webkit-appearance: none; background: #EAC8B7; border-radius: 999px; outline: none; margin-left: 8px; flex-shrink: 0;';

      // Slider thumb styling for audio controls
      if (!document.getElementById('rapira-audio-thumb-style')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'rapira-audio-thumb-style';
        styleTag.textContent = `
          input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 13px; width: 13px; border-radius: 50%; background: #9F190E; cursor: pointer; box-shadow: 0 0 6px rgba(159,25,14,0.5); border: none; }
          input[type=range]::-moz-range-thumb { height: 13px; width: 13px; border-radius: 50%; background: #9F190E; cursor: pointer; border: none; box-shadow: 0 0 6px rgba(159,25,14,0.5); }
        `;
        document.head.appendChild(styleTag);
      }

      const updateVolIcon = (val) => {
        volIcon.className = val === 0 ? 'bi bi-volume-mute ms-2' : val < 0.5 ? 'bi bi-volume-down ms-2' : 'bi bi-volume-up ms-2';
      };

      volSlider.addEventListener('input', (e) => {
        e.stopPropagation();
        const val = parseFloat(e.target.value) / 100;
        audio.volume = val;
        if (val > 0) prevVolume = val;
        updateVolIcon(val);
      });

      volIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (audio.volume > 0) {
          prevVolume = audio.volume;
          audio.volume = 0;
          volSlider.value = '0';
          updateVolIcon(0);
        } else {
          const restore = prevVolume > 0 ? prevVolume : 0.8;
          audio.volume = restore;
          volSlider.value = String(Math.round(restore * 100));
          updateVolIcon(restore);
        }
      });

      playerContainer.appendChild(volIcon);
      playerContainer.appendChild(volSlider);

      audioContainer.appendChild(playerContainer);
      mediaContainer.appendChild(audioContainer);
      console.log('[POST VIEWER] Audio visualizer loaded');

    } else if (currentPost.media.mediaType === 'video') {
      // Create video container that fits the video
      const videoContainer = document.createElement('div');
      videoContainer.style.cssText = 'position: relative; background: black; width: 100%; max-height: 500px; display: flex; align-items: center; justify-content: center; overflow: hidden;';

      // Video element
      const video = document.createElement('video');
      video.src = currentPost.media.url;
      video.style.cssText = 'max-width: 100%; max-height: 500px; height: auto; display: block;';
      videoContainer.appendChild(video);

      // Autoplay handler with fallback for video
      const attemptVideoPlay = () => {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log('[POST VIEWER] Video auto-play blocked. Adding Unmute overlay.');
            // Show a "Click to Play/Unmute" indicator
            const unmuteOverlay = document.createElement('div');
            unmuteOverlay.id = 'video-unmute-overlay';
            unmuteOverlay.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); color: white; padding: 15px 25px; border-radius: 40px; cursor: pointer; z-index: 101; display: flex; align-items: center; gap: 10px; font-weight: 600; backdrop-filter: blur(5px); border: 1px solid rgba(255,255,255,0.2);';
            unmuteOverlay.innerHTML = '<i class="bi bi-play-circle-fill" style="font-size: 1.5rem; color: #9F190E;"></i> TAP TO PLAY';

            unmuteOverlay.onclick = () => {
              video.play();
              unmuteOverlay.remove();
            };
            videoContainer.appendChild(unmuteOverlay);
            playBtn.innerHTML = '<i class="bi bi-play-fill" style="font-size: 1.2rem;"></i>';
          });
        }
      };

      attemptVideoPlay();

      // Custom controls container - OVERLAY ON VIDEO
      const controlsContainer = document.createElement('div');
      controlsContainer.style.cssText = 'position: absolute; bottom: 0; left: 0; right: 0; display: flex; align-items: center; gap: 10px; padding: 12px 15px; background: linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 100%); z-index: 100; opacity: 1;';

      // Play/Pause button
      const playBtn = document.createElement('button');
      playBtn.innerHTML = '<i class="bi bi-pause-fill" style="font-size: 1.2rem;"></i>';
      playBtn.style.cssText = 'background: #9F190E; border: none; color: #FFFFFF; cursor: pointer; padding: 6px 10px; border-radius: 6px; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform 0.2s;';
      playBtn.onmouseover = () => playBtn.style.transform = 'scale(1.1)';
      playBtn.onmouseout = () => playBtn.style.transform = 'scale(1)';

      let isPlaying = true;
      playBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (video.paused) {
          video.play();
        } else {
          video.pause();
        }
      });

      video.addEventListener('play', function () {
        playBtn.innerHTML = '<i class="bi bi-pause-fill" style="font-size: 1.2rem;"></i>';
        isPlaying = true;
      });

      video.addEventListener('pause', function () {
        playBtn.innerHTML = '<i class="bi bi-play-fill" style="font-size: 1.2rem;"></i>';
        isPlaying = false;
      });

      controlsContainer.appendChild(playBtn);

      // Progress bar
      const progressBar = document.createElement('div');
      progressBar.style.cssText = 'flex: 1; height: 6px; background: rgba(255,255,255,0.25); border-radius: 3px; cursor: pointer; position: relative;';

      const progress = document.createElement('div');
      progress.style.cssText = 'height: 100%; background: #9F190E; border-radius: 3px; width: 0%;';
      progressBar.appendChild(progress);

      // Update progress bar
      video.addEventListener('timeupdate', function () {
        const percent = (video.currentTime / video.duration) * 100;
        progress.style.width = percent + '%';
      });

      // Click on progress bar to seek
      progressBar.addEventListener('click', function (e) {
        e.stopPropagation();
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        video.currentTime = percent * video.duration;
      });

      controlsContainer.appendChild(progressBar);

      // Time display
      const timeDisplay = document.createElement('span');
      timeDisplay.textContent = '0:00 / 0:00';
      timeDisplay.style.cssText = 'color: white; font-size: 0.8rem; font-weight: 700; min-width: 90px; text-align: center; flex-shrink: 0; text-shadow: 0 1px 3px rgba(0,0,0,0.8);';

      video.addEventListener('loadedmetadata', updateTimeDisplay);
      video.addEventListener('timeupdate', updateTimeDisplay);

      function updateTimeDisplay() {
        const current = formatTime(video.currentTime);
        const duration = formatTime(video.duration);
        timeDisplay.textContent = current + ' / ' + duration;
      }

      function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins + ':' + (secs < 10 ? '0' : '') + secs;
      }

      controlsContainer.appendChild(timeDisplay);

      // Volume control
      const volumeIcon = document.createElement('i');
      volumeIcon.className = 'bi bi-volume-up-fill';
      volumeIcon.style.cssText = 'color: white; font-size: 1.1rem; flex-shrink: 0; cursor: pointer;';

      const volumeSlider = document.createElement('input');
      volumeSlider.type = 'range';
      volumeSlider.min = '0';
      volumeSlider.max = '100';
      volumeSlider.value = (video.volume * 100).toString();
      volumeSlider.className = 'video-volume-slider';
      volumeSlider.style.cssText = 'cursor: pointer; height: 4px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.3); border-radius: 2px; outline: none; width: 50px; flex-shrink: 0;';

      volumeSlider.addEventListener('input', function (e) {
        e.stopPropagation();
        video.volume = this.value / 100;
        volumeIcon.className = video.volume === 0 ? 'bi bi-volume-mute-fill' : video.volume < 0.5 ? 'bi bi-volume-down-fill' : 'bi bi-volume-up-fill';
      });

      controlsContainer.appendChild(volumeIcon);
      controlsContainer.appendChild(volumeSlider);

      // Click video to toggle play
      videoContainer.addEventListener('click', (e) => {
        if (e.target === video || e.target === videoContainer) {
          if (video.paused) video.play(); else video.pause();
        }
      });

      // Keep controls visible (no auto-hide based on request)
      controlsContainer.style.opacity = '1';

      videoContainer.appendChild(controlsContainer);
      mediaContainer.appendChild(videoContainer);
      console.log('[POST VIEWER] Video loaded with overlay controls');
    } else {
      const img = document.createElement('img');
      img.src = currentPost.media.url;
      img.alt = 'post';
      img.style.cssText = 'max-width: 100%; max-height: 500px; width: 100%; height: auto; object-fit: contain; display: block; border-radius: 8px;';
      mediaContainer.appendChild(img);
    }

    // Update like button state
    updateLikeButton(currentPost.liked);

    // Load inline comments
    loadPostViewerComments();

  } catch (err) {
    console.error('[POST VIEWER] Error loading post:', err);
    showToast('Failed to load post', 'error');

    // Hide modal on error
    const modalElement = document.getElementById('post-viewer');
    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) modal.hide();
    }
  }
}

// Update like button visual state
function updateLikeButton(isLiked) {
  const likeBtn = document.getElementById('post-modal-like-btn');
  const likeIcon = likeBtn?.querySelector('i');
  if (!likeBtn || !likeIcon) return;

  if (isLiked) {
    likeIcon.className = 'bi bi-heart-fill';
    likeIcon.style.color = '#9F190E';
    likeBtn.style.background = '#FCF0E4';
    likeBtn.style.borderColor = '#9F190E';
  } else {
    likeIcon.className = 'bi bi-heart';
    likeIcon.style.color = '#9F190E';
    likeBtn.style.background = '#FFFDF8';
    likeBtn.style.borderColor = '#EAC8B7';
  }
}

// Like/unlike post
async function togglePostLike() {
  if (!currentPost) return;

  console.log('[POST VIEWER] Toggling like for post:', currentPost._id);

  try {
    const res = await fetch(`/posts/${currentPost._id}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      skipLoader: true
    });

    const data = await res.json();
    console.log('[POST VIEWER] Like response:', data);

    if (data.success) {
      currentPost.liked = data.liked;
      currentPost.likesCount = data.likesCount;
      currentPost.fakeLikesLabel = data.fakeLikesLabel || currentPost.fakeLikesLabel || '';
      currentPost.likesDisplay = data.likesDisplay || currentPost.likesDisplay || String(data.likesCount || 0);

      document.getElementById('post-likes-count').textContent = currentPost.likesDisplay || currentPost.fakeLikesLabel || data.likesCount;
      updateLikeButton(data.liked);

      showToast(data.liked ? '❤️ Liked!' : 'Unliked', 'success');
    } else {
      if (res.status === 401) {
        showToast('Please log in to like posts', 'info');
        setTimeout(() => window.location.href = '/auth/login', 1500);
      } else {
        showToast(data.message || 'Failed to like', 'error');
      }
    }
  } catch (err) {
    console.error('[POST VIEWER] Like error:', err);
    showToast('Failed to like post', 'error');
  }
}

// Share post
async function sharePostModal() {
  if (!currentPost) return;

  console.log('[POST VIEWER] Sharing post:', currentPost._id);

  try {
    // Increment share count
    const res = await fetch(`/posts/${currentPost._id}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      skipLoader: true
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        document.getElementById('post-shares-count').textContent = data.shares;
      }
    }
  } catch (err) {
    console.error('[POST VIEWER] Share API error:', err);
  }

  // Generate a URL that will open the post in a popup modal
  const url = `${window.location.origin}#view-post-${currentPost._id}`;
  const title = 'Check out this post on RAPIRA';
  const text = currentPost.caption ? currentPost.caption.substring(0, 100) : 'Check out this post!';

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      showToast('📤 Shared!', 'success');
    } catch (err) {
      if (err.name !== 'AbortError') {
        copyToClipboard(url);
      }
    }
  } else {
    copyToClipboard(url);
  }
}

// Copy to clipboard
function copyToClipboard(url) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('🔗 Link copied!', 'success');
    }).catch(() => {
      showToast('Failed to copy link', 'error');
    });
  } else {
    showToast('Share not supported', 'info');
  }
}

// Toggle Read More/Less for caption
function toggleReadMore() {
  const captionElement = document.getElementById('post-caption');
  const readMoreBtn = document.getElementById('read-more-btn');
  const isExpanded = captionElement.dataset.isExpanded === 'true';

  console.log('[TOGGLE] Current state:', isExpanded ? 'expanded' : 'collapsed');

  if (isExpanded) {
    // Collapse - show truncated text
    captionElement.textContent = captionElement.dataset.truncatedText;
    captionElement.dataset.isExpanded = 'false';
    readMoreBtn.textContent = 'Read More';
    console.log('[TOGGLE] Collapsed to truncated text');
  } else {
    // Expand - show full text
    captionElement.textContent = captionElement.dataset.fullText;
    captionElement.dataset.isExpanded = 'true';
    readMoreBtn.textContent = 'Show Less';
    console.log('[TOGGLE] Expanded to full text');
  }
}

// Show toast notification
function showToast(message, type) {
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6'
  };

  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    background: ${colors[type] || colors.info};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    font-weight: 600;
    animation: slideIn 0.3s ease-out;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Utility to escape HTML
const escapeHtmlViewer = (unsafe) => {
  return (unsafe || '').toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Smoothly scrolls to comments and focuses comment input
window.openPostViewerComments = function () {
  const container = document.getElementById('post-inline-comments-section');
  const input = document.getElementById('postViewerNewComment');
  if (container) {
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  if (input) {
    setTimeout(() => input.focus(), 250);
  }
};

async function loadPostViewerComments() {
  if (!currentPost) return;
  try {
    const res = await fetch(`/posts/${currentPost._id}/comments`);
    const data = await res.json();
    const list = document.getElementById('post-inline-comments-list');
    if (!list) return;

    if (data.success && data.comments.length > 0) {
      document.getElementById('post-inline-comments-count').textContent = data.comments.length;
      document.getElementById('post-comments-count').textContent = data.comments.length;

      const currentUID = document.body.getAttribute('data-user-id');

      const renderReply = (r, c) => {
        const isReplyOwner = currentUID && currentUID === (r.user && r.user._id ? r.user._id : r.user);
        return `
          <div class="reply-card d-flex align-items-start mt-2 ps-3 ms-2" style="display: flex;">
            <img src="${(r.user && r.user.profileImage) ? r.user.profileImage : '/images/default-profile.svg'}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 10px; object-fit: cover;">
            <div class="flex-grow-1">
              <strong class="rh-viewer-reply-author">${r.user && r.user.name ? escapeHtmlViewer(r.user.name) : 'Anonymous'}</strong> 
              <small class="rh-viewer-reply-date ms-2">${new Date(r.createdAt).toLocaleDateString()}</small>
              <p class="rh-viewer-reply-text mb-1" style="word-break: break-word; font-size: 0.9rem;" id="reply-text-${c._id}-${r._id}">${escapeHtmlViewer(r.text)}</p>
              
              ${isReplyOwner ? `
                  <div class="d-flex gap-2">
                     <button class="btn btn-link text-info p-0 text-decoration-none" style="font-size: 0.8rem;" onclick="editReplyViewer('${c._id}', '${r._id}')">Edit</button>
                     <button class="btn btn-link text-danger p-0 text-decoration-none" style="font-size: 0.8rem;" onclick="deleteReplyViewer('${c._id}', '${r._id}')">Delete</button>
                  </div>
              ` : ''}
            </div>
          </div>
        `;
      };

      const renderComment = (c, isHidden = false) => {
        const isOwner = currentUID && currentUID === (c.user && c.user._id ? c.user._id : c.user);
        let repliesHtml = '';
        if (c.replies && c.replies.length > 0) {
          const visibleReplies = c.replies.slice(0, 3);
          const remainingReplies = c.replies.slice(3);

          repliesHtml = visibleReplies.map(r => renderReply(r, c)).join('');

          if (remainingReplies.length > 0) {
            repliesHtml += remainingReplies.map(r => `
              <div class="hidden-reply-${c._id}" style="display: none;">
                ${renderReply(r, c)}
              </div>
            `).join('');
            repliesHtml += `<div class="mt-2 ps-3 ms-2"><button id="btn-show-replies-${c._id}" class="btn btn-link p-0 text-muted" style="font-size: 0.82rem;" onclick="showMoreReplies('${c._id}')">Show ${remainingReplies.length} more replies</button></div>`;
          }
        }

        return `
          <div class="comment-card d-flex align-items-start ${isHidden ? 'hidden-comment' : ''} ${c.isPinned ? 'p-2 rounded bg-success bg-opacity-10 border border-success' : ''}" ${isHidden ? 'style="display: none !important;"' : ''}>
            <img src="${(c.user && c.user.profileImage) ? c.user.profileImage : '/images/default-profile.svg'}" style="width: 32px; height: 32px; border-radius: 50%; margin-right: 12px; object-fit: cover;">
            <div class="flex-grow-1 w-100 pr-2">
              <strong class="rh-viewer-comment-author">${c.user && c.user.name ? escapeHtmlViewer(c.user.name) : 'Anonymous'}</strong> 
              ${c.isPinned ? '<span class="badge bg-success ms-1"><i class="bi bi-pin-angle-fill"></i> Pinned</span>' : ''}
              <small class="rh-viewer-comment-date ms-2">${new Date(c.createdAt).toLocaleDateString()}</small>
              <p class="rh-viewer-comment-text mb-1 mt-1" style="word-break: break-word;" id="comment-text-${c._id}">${escapeHtmlViewer(c.text)}</p>
              
              <div class="d-flex gap-3 mb-2 align-items-center">
                ${currentUID ? `<button class="btn btn-link rh-viewer-reply-action-btn p-0 text-decoration-none" style="font-size: 0.85rem;" onclick="toggleReplyBox('${c._id}')">Reply</button>` : ''}
                ${isOwner ? `
                   <button class="btn btn-link text-info p-0 text-decoration-none" style="font-size: 0.85rem;" onclick="editCommentViewer('${c._id}')">Edit</button>
                   <button class="btn btn-link text-danger p-0 text-decoration-none" style="font-size: 0.85rem;" onclick="deleteCommentViewer('${c._id}')">Delete</button>
                ` : ''}
              </div>

              <!-- Reply Box (Hidden by default) -->
              <div id="reply-box-${c._id}" class="rh-viewer-reply-box d-none mt-2 d-flex gap-2">
                 <input type="text" id="reply-input-${c._id}" class="form-control form-control-sm rh-viewer-reply-input" placeholder="Write a reply..." onkeydown="handleReplyKeydown(event, '${c._id}')">
                 <button class="btn btn-sm rh-viewer-reply-btn" id="reply-submit-btn-${c._id}" onclick="submitReplyViewer('${c._id}')" aria-label="Send reply"><i class="bi bi-send-fill"></i></button>
              </div>

              <!-- Nested Replies -->
              ${repliesHtml}
            </div>
          </div>
        `;
      };

      // Separate into comments to display and remaining
      const visibleComments = data.comments.slice(0, 3);
      const remainingComments = data.comments.slice(3);

      let contentHtml = visibleComments.map(c => renderComment(c, false)).join('');

      // Mount all other comments underneath invisible by default
      if (remainingComments.length > 0) {
        contentHtml += remainingComments.map(c => renderComment(c, true)).join('');
        contentHtml += `<div class="text-center mt-3"><button id="btn-show-comments" class="btn btn-outline-secondary btn-sm" onclick="showMoreComments()">View ${remainingComments.length} more comments...</button></div>`;
      }

      list.innerHTML = contentHtml;
    } else {
      list.innerHTML = '<div class="text-center text-muted py-3">No comments yet. Be the first!</div>';
      if (document.getElementById('post-inline-comments-count')) document.getElementById('post-inline-comments-count').textContent = '0';
      if (document.getElementById('post-comments-count')) document.getElementById('post-comments-count').textContent = '0';
    }
  } catch (err) {
    console.error('Load comments error:', err);
    if (document.getElementById('post-inline-comments-list')) {
      document.getElementById('post-inline-comments-list').innerHTML = '<div class="text-center text-danger py-3">Failed to load comments</div>';
    }
  }
}

// Comments editing and replying logic
// Show more logic bindings
window.showMoreComments = function () {
  document.querySelectorAll('.hidden-comment').forEach(el => {
    el.style.setProperty("display", "flex", "important");
  });
  const btn = document.getElementById('btn-show-comments');
  if (btn) btn.style.display = 'none';
};

window.showMoreReplies = function (commentId) {
  document.querySelectorAll(`.hidden-reply-${commentId}`).forEach(el => {
    el.style.setProperty("display", "flex", "important");
  });
  const btn = document.getElementById(`btn-show-replies-${commentId}`);
  if (btn) btn.style.display = 'none';
};

window.toggleReplyBox = function (commentId) {
  const box = document.getElementById(`reply-box-${commentId}`);
  if (box) {
    box.classList.toggle('d-none');
    if (!box.classList.contains('d-none')) {
      document.getElementById(`reply-input-${commentId}`).focus();
    }
  }
};

window.handleReplyKeydown = function (event, commentId) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submitReplyViewer(commentId);
  }
};

window.submitReplyViewer = async function (commentId) {
  if (!currentPost) return;
  const input = document.getElementById(`reply-input-${commentId}`);
  const btn = document.getElementById(`reply-submit-btn-${commentId}`);
  const text = input ? input.value.trim() : '';
  if (!text) return;

  if (btn) btn.disabled = true;
  if (input) input.disabled = true;

  try {
    const res = await fetch(`/posts/${currentPost._id}/comments/${commentId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      skipLoader: true
    });
    const data = await res.json();
    if (data.success) {
      if (input) input.value = '';
      showToast('Reply added', 'success');
      await loadPostViewerComments();
    } else {
      if (res.status === 401) {
        showToast('Please log in to reply', 'info');
        setTimeout(() => window.location.href = '/auth/login', 1500);
      } else {
        showToast(data.message || 'Failed to reply', 'error');
      }
    }
  } catch (err) {
    showToast('Error replying', 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (input) input.disabled = false;
  }
};

window.deleteCommentViewer = async function (commentId) {
  if (!currentPost || !confirm("Delete your comment?")) return;
  try {
    const res = await fetch(`/posts/${currentPost._id}/comments/${commentId}`, { method: 'DELETE', skipLoader: true });
    const data = await res.json();
    if (data.success) {
      await loadPostViewerComments();
    } else {
      showToast(data.message || 'Failed to delete', 'error');
    }
  } catch (err) {
    showToast('Error deleting comment', 'error');
  }
};

window.editCommentViewer = async function (commentId) {
  if (!currentPost) return;
  const currentText = document.getElementById(`comment-text-${commentId}`).innerText;
  const newText = prompt("Edit your comment:", currentText);
  if (!newText || newText === currentText) return;
  try {
    const res = await fetch(`/posts/${currentPost._id}/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newText }),
      skipLoader: true
    });
    const data = await res.json();
    if (data.success) {
      await loadPostViewerComments();
    } else {
      showToast(data.message || 'Failed to edit', 'error');
    }
  } catch (err) {
    showToast('Error editing comment', 'error');
  }
};

window.deleteReplyViewer = async function (commentId, replyId) {
  if (!currentPost || !confirm("Delete your reply?")) return;
  try {
    const res = await fetch(`/posts/${currentPost._id}/comments/${commentId}/replies/${replyId}`, { method: 'DELETE', skipLoader: true });
    const data = await res.json();
    if (data.success) {
      await loadPostViewerComments();
    } else {
      showToast(data.message || 'Failed to delete', 'error');
    }
  } catch (err) {
    showToast('Error deleting reply', 'error');
  }
};

window.editReplyViewer = async function (commentId, replyId) {
  if (!currentPost) return;
  const currentText = document.getElementById(`reply-text-${commentId}-${replyId}`).innerText;
  const newText = prompt("Edit your reply:", currentText);
  if (!newText || newText === currentText) return;
  try {
    const res = await fetch(`/posts/${currentPost._id}/comments/${commentId}/replies/${replyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newText }),
      skipLoader: true
    });
    const data = await res.json();
    if (data.success) {
      await loadPostViewerComments();
    } else {
      showToast(data.message || 'Failed to edit', 'error');
    }
  } catch (err) {
    showToast('Error editing reply', 'error');
  }
};

// Open report modal
window.openPostViewerReport = function () {
  if (!currentPost) return;
  const m = new bootstrap.Modal(document.getElementById('postViewerReportModal'));
  m.show();
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function () {
  console.log('[POST VIEWER] Initializing...');

  // Set current user ID from data attribute on body
  currentUserId = document.body.dataset.userId || null;
  console.log('[POST VIEWER] Current user ID:', currentUserId);

  // Attach event listeners
  const likeBtn = document.getElementById('post-modal-like-btn');
  const shareBtn = document.getElementById('post-modal-share-btn');

  if (likeBtn) {
    likeBtn.addEventListener('click', togglePostLike);
    console.log('[POST VIEWER] Like button listener attached');
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', sharePostModal);
    console.log('[POST VIEWER] Share button listener attached');
  }

  // Comments submit
  const commentBtn = document.getElementById('submitPostViewerCommentBtn');
  const commentInput = document.getElementById('postViewerNewComment');

  if (commentInput && commentBtn) {
    commentInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commentBtn.click();
      }
    });
  }

  if (commentBtn) {
    commentBtn.addEventListener('click', async function () {
      if (!currentPost) return;

      const text = commentInput ? commentInput.value.trim() : '';
      if (!text) return;

      const btn = this;
      const originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" style="width: 1rem; height: 1rem; border-width: 2px;"></span>';
      if (commentInput) commentInput.disabled = true;

      try {
        const res = await fetch(`/posts/${currentPost._id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          skipLoader: true
        });
        const data = await res.json();

        if (data.success) {
          if (commentInput) commentInput.value = '';
          showToast('Comment posted', 'success');
          await loadPostViewerComments();
        } else {
          if (res.status === 401) {
            showToast('You must be logged in to comment.', 'info');
            setTimeout(() => window.location.href = '/auth/login', 1500);
          } else {
            showToast(data.message || 'Failed to post comment', 'error');
          }
        }
      } catch (err) {
        showToast('Error posting comment', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        if (commentInput) {
          commentInput.disabled = false;
          commentInput.focus();
        }
      }
    });
  }

  // Report submit
  const reportBtn = document.getElementById('submitPostViewerReportBtn');
  if (reportBtn) {
    reportBtn.addEventListener('click', async function () {
      if (!currentPost) return;

      const reason = document.getElementById('postViewerReportReason').value.trim();
      if (!reason) {
        showToast('Please enter a reason', 'error');
        return;
      }

      const btn = this;
      btn.disabled = true;
      btn.innerHTML = 'Submitting...';

      try {
        const res = await fetch(`/posts/${currentPost._id}/report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
          skipLoader: true
        });
        const data = await res.json();
        if (data.success) {
          showToast('Post reported. Thank you.', 'success');
          const m = bootstrap.Modal.getInstance(document.getElementById('postViewerReportModal'));
          if (m) m.hide();
          document.getElementById('postViewerReportReason').value = '';
        } else {
          if (res.status === 401) {
            showToast('You must be logged in to report.', 'info');
            setTimeout(() => window.location.href = '/auth/login', 1500);
          } else {
            showToast(data.message || 'Failed to report', 'error');
          }
        }
      } catch (err) {
        showToast('Error sending report', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Submit Report';
      }
    });
  }

  // Stop media playback immediately when modal starts hiding or finishes closing
  const modalElement = document.getElementById('post-viewer');
  if (modalElement) {
    modalElement.addEventListener('show.bs.modal', function () {
      document.body.classList.add('rh-viewer-open-lock');
    });
    modalElement.addEventListener('hide.bs.modal', function () {
      stopMediaPlayback();
    });
    modalElement.addEventListener('hidden.bs.modal', function () {
      stopMediaPlayback();
      document.body.classList.remove('rh-viewer-open-lock');
      console.log('[POST VIEWER] Modal closed, media stopped');
    });
  }

  // Add animations and hover states in Rapira Palette
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
    .rh-viewer-open-lock {
      overflow: hidden !important;
    }
    #post-artist-link:hover #post-artist-name,
    #post-artist-link-mobile:hover #post-artist-name-mobile {
      color: #9F190E !important;
    }
    #post-artist-img:hover,
    #post-artist-img-mobile:hover {
      transform: scale(1.05);
      border-color: #9F190E;
    }
  `;
  document.head.appendChild(style);
});
