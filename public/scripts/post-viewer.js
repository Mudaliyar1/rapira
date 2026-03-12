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
    const res = await fetch(`/posts/${postId}/json`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
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

    document.getElementById('post-artist-name').textContent = currentPost.artist.stageName || 'Artist';
    artistLink.href = artistProfileUrl;
    artistImg.src = currentPost.artist.profileImage || '/images/default-profile.svg';
    artistImg.style.cursor = 'pointer';
    artistImg.onclick = () => window.location.href = artistProfileUrl;

    document.getElementById('post-created-at').textContent = formatTimeAgo(currentPost.createdAt);
    document.getElementById('post-likes-count').textContent = currentPost.likesCount || 0;
    document.getElementById('post-shares-count').textContent = currentPost.shares || 0;
    document.getElementById('post-views-count').textContent = currentPost.views || 0;
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
        span.style.color = '#00d4ff';
        span.style.fontSize = '0.95rem';
        span.style.marginRight = '8px';
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

    if (currentPost.media.mediaType === 'video') {
      // Create video container that fits the video
      const videoContainer = document.createElement('div');
      videoContainer.style.cssText = 'position: relative; background: black; width: 100%; max-height: 500px; display: flex; align-items: center; justify-content: center; overflow: hidden;';

      // Video element
      const video = document.createElement('video');
      video.src = currentPost.media.url;
      video.autoplay = true;
      video.style.cssText = 'max-width: 100%; max-height: 500px; height: auto; display: block;';
      videoContainer.appendChild(video);

      // Custom controls container - OVERLAY ON VIDEO
      const controlsContainer = document.createElement('div');
      controlsContainer.style.cssText = 'position: absolute; bottom: 0; left: 0; right: 0; display: flex; align-items: center; gap: 10px; padding: 12px 15px; background: linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 100%); z-index: 100; opacity: 1;';

      // Play/Pause button
      const playBtn = document.createElement('button');
      playBtn.innerHTML = '<i class="bi bi-pause-fill" style="font-size: 1.2rem;"></i>';
      playBtn.style.cssText = 'background: white; border: none; color: #333; cursor: pointer; padding: 6px 10px; border-radius: 6px; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform 0.2s;';
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
      progress.style.cssText = 'height: 100%; background: #00d4ff; border-radius: 3px; width: 0%;';
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
    } else if (currentPost.media.mediaType === 'audio') {
      // Create audio player container (Spotify-like minimal design)
      const audioContainer = document.createElement('div');
      audioContainer.style.cssText = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px 30px; border-radius: 12px; text-align: center; min-height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; width: 100%;';

      // Music icon
      const icon = document.createElement('i');
      icon.className = 'bi bi-music-note-beamed';
      icon.style.cssText = 'font-size: 4rem; color: white; display: block;';
      audioContainer.appendChild(icon);

      // Label
      const label = document.createElement('div');
      label.textContent = 'Audio Post';
      label.style.cssText = 'color: white; font-weight: 600; font-size: 1.3rem; letter-spacing: 0.5px;';
      audioContainer.appendChild(label);

      // Audio player (hidden)
      const audio = document.createElement('audio');
      audio.src = currentPost.media.url;
      audio.autoplay = true;
      audio.style.cssText = 'display: none;';
      audioContainer.appendChild(audio);

      // Minimal player container (Spotify style)
      const playerContainer = document.createElement('div');
      playerContainer.style.cssText = 'display: flex; align-items: center; gap: 12px; width: 100%; max-width: 380px;';

      // Play/Pause button - minimal circular
      const playBtn = document.createElement('button');
      playBtn.innerHTML = '<i class="bi bi-play-fill" style="font-size: 0.9rem;"></i>';
      playBtn.style.cssText = 'background: white; border: none; color: #667eea; cursor: pointer; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; flex-shrink: 0; font-size: 0.9rem;';
      playBtn.onmouseover = () => {
        playBtn.style.transform = 'scale(1.08)';
        playBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
      };
      playBtn.onmouseout = () => {
        playBtn.style.transform = 'scale(1)';
        playBtn.style.boxShadow = 'none';
      };

      let isPlaying = false;
      playBtn.addEventListener('click', function () {
        if (isPlaying) {
          audio.pause();
          playBtn.innerHTML = '<i class="bi bi-play-fill" style="font-size: 0.9rem;"></i>';
          isPlaying = false;
        } else {
          audio.play();
          playBtn.innerHTML = '<i class="bi bi-pause-fill" style="font-size: 0.9rem;"></i>';
          isPlaying = true;
        }
      });

      audio.addEventListener('ended', function () {
        playBtn.innerHTML = '<i class="bi bi-play-fill" style="font-size: 0.9rem;"></i>';
        isPlaying = false;
      });

      // Update button when autoplay starts playing
      audio.addEventListener('play', function () {
        playBtn.innerHTML = '<i class="bi bi-pause-fill" style="font-size: 0.9rem;"></i>';
        isPlaying = true;
      });

      // Update button when audio is paused
      audio.addEventListener('pause', function () {
        playBtn.innerHTML = '<i class="bi bi-play-fill" style="font-size: 0.9rem;"></i>';
        isPlaying = false;
      });

      playerContainer.appendChild(playBtn);

      // Progress bar container
      const progressContainer = document.createElement('div');
      progressContainer.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 4px;';

      // Progress bar - thin and subtle
      const progressBar = document.createElement('div');
      progressBar.style.cssText = 'height: 3px; background: rgba(255,255,255,0.25); border-radius: 2px; cursor: pointer; position: relative; overflow: hidden;';

      const progress = document.createElement('div');
      progress.style.cssText = 'height: 100%; background: white; border-radius: 2px; width: 0%; transition: width 0.1s linear;';
      progressBar.appendChild(progress);

      // Update progress bar
      audio.addEventListener('timeupdate', function () {
        const percent = (audio.currentTime / audio.duration) * 100;
        progress.style.width = percent + '%';
      });

      // Click on progress bar to seek
      progressBar.addEventListener('click', function (e) {
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * audio.duration;
      });

      // Draggable progress bar for audio
      let isAudioDragging = false;
      progressBar.addEventListener('mousedown', function () {
        isAudioDragging = true;
      });

      document.addEventListener('mousemove', function (e) {
        if (isAudioDragging && progressBar) {
          const rect = progressBar.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right) {
            const percent = (e.clientX - rect.left) / rect.width;
            audio.currentTime = percent * audio.duration;
          }
        }
      });

      document.addEventListener('mouseup', function () {
        isAudioDragging = false;
      });

      progressContainer.appendChild(progressBar);

      // Time display - minimal
      const timeDisplay = document.createElement('div');
      timeDisplay.textContent = '0:00 / 0:00';
      timeDisplay.style.cssText = 'color: rgba(255,255,255,0.8); font-size: 0.75rem; font-weight: 500; text-align: center; letter-spacing: 0.3px;';

      function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins + ':' + (secs < 10 ? '0' : '') + secs;
      }

      audio.addEventListener('loadedmetadata', function () {
        updateTimeDisplay();
      });

      audio.addEventListener('timeupdate', function () {
        updateTimeDisplay();
      });

      function updateTimeDisplay() {
        const current = formatTime(audio.currentTime);
        const duration = formatTime(audio.duration);
        timeDisplay.textContent = current + ' / ' + duration;
      }

      progressContainer.appendChild(timeDisplay);

      // Volume control for audio
      const volumeContainer = document.createElement('div');
      volumeContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-top: 12px;';

      const volumeIcon = document.createElement('i');
      volumeIcon.className = 'bi bi-volume-up';
      volumeIcon.style.cssText = 'color: rgba(255,255,255,0.8); font-size: 0.85rem;';

      const volumeSlider = document.createElement('input');
      volumeSlider.type = 'range';
      volumeSlider.min = '0';
      volumeSlider.max = '100';
      volumeSlider.value = '100';
      volumeSlider.style.cssText = 'flex: 1; cursor: pointer; height: 4px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.25); border-radius: 2px; outline: none;';
      volumeSlider.style.setProperty('-webkit-appearance', 'none');

      // Style the slider thumb
      const style = document.createElement('style');
      style.textContent = `
        input[type='range'] {
          -webkit-appearance: none;
          width: 100%;
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
        }
        input[type='range']::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
        }
      `;
      if (!document.head.querySelector('style[data-volume-slider]')) {
        style.setAttribute('data-volume-slider', 'true');
        document.head.appendChild(style);
      }

      volumeSlider.addEventListener('input', function () {
        audio.volume = this.value / 100;
      });

      volumeContainer.appendChild(volumeIcon);
      volumeContainer.appendChild(volumeSlider);
      progressContainer.appendChild(volumeContainer);
      playerContainer.appendChild(progressContainer);

      audioContainer.appendChild(playerContainer);
      mediaContainer.appendChild(audioContainer);
      console.log('[POST VIEWER] Audio media loaded with minimal player');
    } else {
      const img = document.createElement('img');
      img.src = currentPost.media.url;
      img.alt = 'post';
      img.style.cssText = 'max-width: 100%; max-height: 500px; width: 100%; height: auto; object-fit: contain; display: block;';
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
    likeIcon.style.color = '#ff1744';
    likeBtn.style.background = 'rgba(255, 23, 68, 0.15)';
    likeBtn.style.borderColor = '#ff1744';
  } else {
    likeIcon.className = 'bi bi-heart';
    likeIcon.style.color = '#fff';
    likeBtn.style.background = 'rgba(255, 255, 255, 0.05)';
    likeBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
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

      document.getElementById('post-likes-count').textContent = data.likesCount;
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

// Remove openComments action button since comments are now inline
window.openPostViewerComments = function () {
  const container = document.getElementById('post-inline-comments-section');
  if (container) {
    container.scrollIntoView({ behavior: 'smooth' });
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

      // Separate into comments to display and remaining
      const visibleComments = data.comments.slice(0, 3);
      const remainingComments = data.comments.slice(3);

      let contentHtml = visibleComments.map(c => {
        const currentUID = document.body.getAttribute('data-user-id');
        const isOwner = currentUID && currentUID === (c.user && c.user._id ? c.user._id : c.user);

        let repliesHtml = '';
        if (c.replies && c.replies.length > 0) {
          const visibleReplies = c.replies.slice(0, 3);
          const remainingReplies = c.replies.slice(3);

          repliesHtml = visibleReplies.map(r => {
            const isReplyOwner = currentUID && currentUID === (r.user && r.user._id ? r.user._id : r.user);
            return `
                 <div class="reply-card d-flex align-items-start mt-2 ps-4 ms-2 border-start border-secondary" style="display: flex;">
                   <img src="${(r.user && r.user.profileImage) ? r.user.profileImage : '/images/default-profile.svg'}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 10px; object-fit: cover;">
                   <div class="flex-grow-1">
                     <strong>${r.user && r.user.name ? escapeHtmlViewer(r.user.name) : 'Anonymous'}</strong> 
                     <small class="text-muted ms-2">${new Date(r.createdAt).toLocaleDateString()}</small>
                     <p class="mb-1" style="word-break: break-word; font-size: 0.9rem;" id="reply-text-${c._id}-${r._id}">${escapeHtmlViewer(r.text)}</p>
                     
                     ${isReplyOwner ? `
                         <div class="d-flex gap-2">
                            <button class="btn btn-link text-info p-0 text-decoration-none" style="font-size: 0.8rem;" onclick="editReplyViewer('${c._id}', '${r._id}')">Edit</button>
                            <button class="btn btn-link text-danger p-0 text-decoration-none" style="font-size: 0.8rem;" onclick="deleteReplyViewer('${c._id}', '${r._id}')">Delete</button>
                         </div>
                     ` : ''}
                   </div>
                 </div>
                 `;
          }).join('');

          // Append remaining hidden replies if they exist
          if (remainingReplies.length > 0) {
            repliesHtml += remainingReplies.map(r => {
              const isReplyOwner = currentUID && currentUID === (r.user && r.user._id ? r.user._id : r.user);
              return `
                 <div class="reply-card hidden-reply-${c._id} d-flex align-items-start mt-2 ps-4 ms-2 border-start border-secondary" style="display: none;">
                   <img src="${(r.user && r.user.profileImage) ? r.user.profileImage : '/images/default-profile.svg'}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 10px; object-fit: cover;">
                   <div class="flex-grow-1">
                     <strong>${r.user && r.user.name ? escapeHtmlViewer(r.user.name) : 'Anonymous'}</strong> 
                     <small class="text-muted ms-2">${new Date(r.createdAt).toLocaleDateString()}</small>
                     <p class="mb-1" style="word-break: break-word; font-size: 0.9rem;" id="reply-text-${c._id}-${r._id}">${escapeHtmlViewer(r.text)}</p>
                     
                     ${isReplyOwner ? `
                         <div class="d-flex gap-2">
                            <button class="btn btn-link text-info p-0 text-decoration-none" style="font-size: 0.8rem;" onclick="editReplyViewer('${c._id}', '${r._id}')">Edit</button>
                            <button class="btn btn-link text-danger p-0 text-decoration-none" style="font-size: 0.8rem;" onclick="deleteReplyViewer('${c._id}', '${r._id}')">Delete</button>
                         </div>
                     ` : ''}
                   </div>
                 </div>
                 `;
            }).join('');
            repliesHtml += `<div class="mt-2 ps-4 ms-2"><button id="btn-show-replies-${c._id}" class="btn btn-link p-0 text-muted" style="font-size: 0.85rem;" onclick="showMoreReplies('${c._id}')">Show ${remainingReplies.length} more replies</button></div>`;
          }
        }

        return `
         <div class="comment-card d-flex align-items-start ${c.isPinned ? 'p-2 rounded bg-success bg-opacity-10 border border-success' : ''}">
           <img src="${(c.user && c.user.profileImage) ? c.user.profileImage : '/images/default-profile.svg'}" style="width: 32px; height: 32px; border-radius: 50%; margin-right: 12px; object-fit: cover;">
           <div class="flex-grow-1 w-100 pr-2">
             <strong>${c.user && c.user.name ? escapeHtmlViewer(c.user.name) : 'Anonymous'}</strong> 
             ${c.isPinned ? '<span class="badge bg-success ms-1"><i class="bi bi-pin-angle-fill"></i> Pinned</span>' : ''}
             <small class="text-muted ms-2">${new Date(c.createdAt).toLocaleDateString()}</small>
             <p class="mb-1 mt-1" style="word-break: break-word;" id="comment-text-${c._id}">${escapeHtmlViewer(c.text)}</p>
             
             <div class="d-flex gap-3 mb-2 align-items-center">
               ${currentUID ? `<button class="btn btn-link text-success p-0 text-decoration-none" style="font-size: 0.85rem;" onclick="toggleReplyBox('${c._id}')">Reply</button>` : ''}
               ${isOwner ? `
                  <button class="btn btn-link text-info p-0 text-decoration-none" style="font-size: 0.85rem;" onclick="editCommentViewer('${c._id}')">Edit</button>
                  <button class="btn btn-link text-danger p-0 text-decoration-none" style="font-size: 0.85rem;" onclick="deleteCommentViewer('${c._id}')">Delete</button>
               ` : ''}
             </div>
 
             <!-- Reply Box (Hidden by default) -->
             <div id="reply-box-${c._id}" class="d-none mt-2 d-flex gap-2">
                <input type="text" id="reply-input-${c._id}" class="form-control form-control-sm bg-dark text-white border-secondary" placeholder="Write a reply...">
                <button class="btn btn-sm btn-success" onclick="submitReplyViewer('${c._id}')"><i class="bi bi-send"></i></button>
             </div>
 
             <!-- Nested Replies -->
             ${repliesHtml}
           </div>
         </div>
       `;
      }).join('');

      // Mount all other comments underneath invisible by default
      if (remainingComments.length > 0) {
        contentHtml += remainingComments.map(c => {
          const currentUID = document.body.getAttribute('data-user-id');
          const isOwner = currentUID && currentUID === (c.user && c.user._id ? c.user._id : c.user);

          let repliesHtml = '';
          if (c.replies && c.replies.length > 0) {
            const visibleReplies = c.replies.slice(0, 3);
            const remainingReplies = c.replies.slice(3);

            repliesHtml = visibleReplies.map(r => {
              const isReplyOwner = currentUID && currentUID === (r.user && r.user._id ? r.user._id : r.user);
              return `
                    <div class="reply-card d-flex align-items-start mt-2 ps-4 ms-2 border-start border-secondary" style="display: flex;">
                      <img src="${(r.user && r.user.profileImage) ? r.user.profileImage : '/images/default-profile.svg'}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 10px; object-fit: cover;">
                      <div class="flex-grow-1">
                        <strong>${r.user && r.user.name ? escapeHtmlViewer(r.user.name) : 'Anonymous'}</strong> 
                        <small class="text-muted ms-2">${new Date(r.createdAt).toLocaleDateString()}</small>
                        <p class="mb-1" style="word-break: break-word; font-size: 0.9rem;" id="reply-text-${c._id}-${r._id}">${escapeHtmlViewer(r.text)}</p>
                        
                        ${isReplyOwner ? `
                            <div class="d-flex gap-2">
                               <button class="btn btn-link text-info p-0 text-decoration-none" style="font-size: 0.8rem;" onclick="editReplyViewer('${c._id}', '${r._id}')">Edit</button>
                               <button class="btn btn-link text-danger p-0 text-decoration-none" style="font-size: 0.8rem;" onclick="deleteReplyViewer('${c._id}', '${r._id}')">Delete</button>
                            </div>
                        ` : ''}
                      </div>
                    </div>
                    `;
            }).join('');

            if (remainingReplies.length > 0) {
              repliesHtml += remainingReplies.map(r => {
                const isReplyOwner = currentUID && currentUID === (r.user && r.user._id ? r.user._id : r.user);
                return `
                    <div class="reply-card hidden-reply-${c._id} d-flex align-items-start mt-2 ps-4 ms-2 border-start border-secondary" style="display: none;">
                      <img src="${(r.user && r.user.profileImage) ? r.user.profileImage : '/images/default-profile.svg'}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 10px; object-fit: cover;">
                      <div class="flex-grow-1">
                        <strong>${r.user && r.user.name ? escapeHtmlViewer(r.user.name) : 'Anonymous'}</strong> 
                        <small class="text-muted ms-2">${new Date(r.createdAt).toLocaleDateString()}</small>
                        <p class="mb-1" style="word-break: break-word; font-size: 0.9rem;" id="reply-text-${c._id}-${r._id}">${escapeHtmlViewer(r.text)}</p>
                        
                        ${isReplyOwner ? `
                            <div class="d-flex gap-2">
                               <button class="btn btn-link text-info p-0 text-decoration-none" style="font-size: 0.8rem;" onclick="editReplyViewer('${c._id}', '${r._id}')">Edit</button>
                               <button class="btn btn-link text-danger p-0 text-decoration-none" style="font-size: 0.8rem;" onclick="deleteReplyViewer('${c._id}', '${r._id}')">Delete</button>
                            </div>
                        ` : ''}
                      </div>
                    </div>
                    `;
              }).join('');
              repliesHtml += `<div class="mt-2 ps-4 ms-2"><button id="btn-show-replies-${c._id}" class="btn btn-link p-0 text-muted" style="font-size: 0.85rem;" onclick="showMoreReplies('${c._id}')">Show ${remainingReplies.length} more replies</button></div>`;
            }
          }

          return `
            <div class="comment-card hidden-comment d-flex align-items-start ${c.isPinned ? 'p-2 rounded bg-success bg-opacity-10 border border-success' : ''}" style="display: none !important;">
              <img src="${(c.user && c.user.profileImage) ? c.user.profileImage : '/images/default-profile.svg'}" style="width: 32px; height: 32px; border-radius: 50%; margin-right: 12px; object-fit: cover;">
              <div class="flex-grow-1 w-100 pr-2">
                <strong>${c.user && c.user.name ? escapeHtmlViewer(c.user.name) : 'Anonymous'}</strong> 
                ${c.isPinned ? '<span class="badge bg-success ms-1"><i class="bi bi-pin-angle-fill"></i> Pinned</span>' : ''}
                <small class="text-muted ms-2">${new Date(c.createdAt).toLocaleDateString()}</small>
                <p class="mb-1 mt-1" style="word-break: break-word;" id="comment-text-${c._id}">${escapeHtmlViewer(c.text)}</p>
                
                <div class="d-flex gap-3 mb-2 align-items-center">
                  ${currentUID ? `<button class="btn btn-link text-success p-0 text-decoration-none" style="font-size: 0.85rem;" onclick="toggleReplyBox('${c._id}')">Reply</button>` : ''}
                  ${isOwner ? `
                     <button class="btn btn-link text-info p-0 text-decoration-none" style="font-size: 0.85rem;" onclick="editCommentViewer('${c._id}')">Edit</button>
                     <button class="btn btn-link text-danger p-0 text-decoration-none" style="font-size: 0.85rem;" onclick="deleteCommentViewer('${c._id}')">Delete</button>
                  ` : ''}
                </div>
    
                <!-- Reply Box (Hidden by default) -->
                <div id="reply-box-${c._id}" class="d-none mt-2 d-flex gap-2">
                   <input type="text" id="reply-input-${c._id}" class="form-control form-control-sm bg-dark text-white border-secondary" placeholder="Write a reply...">
                   <button class="btn btn-sm btn-success" onclick="submitReplyViewer('${c._id}')"><i class="bi bi-send"></i></button>
                </div>
    
                <!-- Nested Replies -->
                ${repliesHtml}
              </div>
            </div>
          `;
        }).join('');

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

window.submitReplyViewer = async function (commentId) {
  if (!currentPost) return;
  const input = document.getElementById(`reply-input-${commentId}`);
  const text = input.value.trim();
  if (!text) return;
  try {
    const res = await fetch(`/posts/${currentPost._id}/comments/${commentId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      skipLoader: true
    });
    const data = await res.json();
    if (data.success) {
      await loadPostViewerComments();
    } else {
      showToast(data.message || 'Failed to reply', 'error');
    }
  } catch (err) {
    showToast('Error replying', 'error');
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
  if (commentBtn) {
    commentBtn.addEventListener('click', async function () {
      if (!currentPost) return;

      const text = document.getElementById('postViewerNewComment').value.trim();
      if (!text) return;

      const btn = this;
      btn.disabled = true;

      try {
        const res = await fetch(`/posts/${currentPost._id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          skipLoader: true
        });
        const data = await res.json();

        if (data.success) {
          document.getElementById('postViewerNewComment').value = '';
          showToast('Comment posted', 'success');
          loadPostViewerComments();
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

  // Stop media playback when modal closes
  const modalElement = document.getElementById('post-viewer');
  if (modalElement) {
    modalElement.addEventListener('hidden.bs.modal', function () {
      stopMediaPlayback();
      console.log('[POST VIEWER] Modal closed, media stopped');
    });
  }

  // Add animations
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
    #post-modal-like-btn:hover, #post-modal-share-btn:hover, #post-modal-comments-btn:hover, #post-modal-report-btn:hover {
      transform: scale(1.15);
    }
    #post-modal-like-btn:active, #post-modal-share-btn:active, #post-modal-comments-btn:active, #post-modal-report-btn:active {
      transform: scale(0.95);
    }
    #post-artist-link:hover #post-artist-name {
      color: #00d4ff !important;
    }
    #post-artist-img:hover {
      transform: scale(1.05);
      border-color: #00d4ff;
    }
  `;
  document.head.appendChild(style);
});
