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
      
      // Update like button to default state
      updateLikeButton(false);
      
      // Show modal immediately
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
    
    // Fetch post data
    const res = await fetch(`/posts/${postId}/json`);
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
      // Create video container
      const videoContainer = document.createElement('div');
      videoContainer.style.cssText = 'position: relative; background: black; border-radius: 8px 8px 0 0; overflow: hidden;';
      
      // Video element (without controls)
      const video = document.createElement('video');
      video.src = currentPost.media.url;
      video.autoplay = true;
      video.style.cssText = 'width: 100%; height: auto; display: block;';
      videoContainer.appendChild(video);
      
      // Custom controls container - BELOW VIDEO (not overlay)
      const controlsContainer = document.createElement('div');
      controlsContainer.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 15px; background: rgba(0,0,0,0.3); border-top: 1px solid rgba(255,255,255,0.1);';
      
      // Play/Pause button
      const playBtn = document.createElement('button');
      playBtn.innerHTML = '<i class="bi bi-play-fill" style="font-size: 1.2rem;"></i>';
      playBtn.style.cssText = 'background: white; border: none; color: #333; cursor: pointer; padding: 8px 12px; border-radius: 4px; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;';
      
      let isPlaying = false;
      playBtn.addEventListener('click', function() {
        if (isPlaying) {
          video.pause();
          playBtn.innerHTML = '<i class="bi bi-play-fill" style="font-size: 1.2rem;"></i>';
          isPlaying = false;
        } else {
          video.play();
          playBtn.innerHTML = '<i class="bi bi-pause-fill" style="font-size: 1.2rem;"></i>';
          isPlaying = true;
        }
      });
      
      video.addEventListener('play', function() {
        playBtn.innerHTML = '<i class="bi bi-pause-fill" style="font-size: 1.2rem;"></i>';
        isPlaying = true;
      });
      
      video.addEventListener('pause', function() {
        playBtn.innerHTML = '<i class="bi bi-play-fill" style="font-size: 1.2rem;"></i>';
        isPlaying = false;
      });
      
      controlsContainer.appendChild(playBtn);
      
      // Progress bar
      const progressBar = document.createElement('div');
      progressBar.style.cssText = 'flex: 1; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; cursor: pointer; position: relative;';
      
      const progress = document.createElement('div');
      progress.style.cssText = 'height: 100%; background: #ff006e; border-radius: 2px; width: 0%;';
      progressBar.appendChild(progress);
      
      // Update progress bar
      video.addEventListener('timeupdate', function() {
        const percent = (video.currentTime / video.duration) * 100;
        progress.style.width = percent + '%';
      });
      
      // Click on progress bar to seek
      progressBar.addEventListener('click', function(e) {
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        video.currentTime = percent * video.duration;
      });
      
      // Draggable progress bar
      let isDragging = false;
      progressBar.addEventListener('mousedown', function() {
        isDragging = true;
      });
      
      document.addEventListener('mousemove', function(e) {
        if (isDragging && progressBar) {
          const rect = progressBar.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right) {
            const percent = (e.clientX - rect.left) / rect.width;
            video.currentTime = percent * video.duration;
          }
        }
      });
      
      document.addEventListener('mouseup', function() {
        isDragging = false;
      });
      
      controlsContainer.appendChild(progressBar);
      
      // Time display
      const timeDisplay = document.createElement('span');
      timeDisplay.textContent = '0:00 / 0:00';
      timeDisplay.style.cssText = 'color: white; font-size: 0.85rem; font-weight: bold; min-width: 60px; flex-shrink: 0;';
      
      video.addEventListener('loadedmetadata', function() {
        updateTimeDisplay();
      });
      
      video.addEventListener('timeupdate', function() {
        updateTimeDisplay();
      });
      
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
      
      // Volume control - ON THE RIGHT SIDE OF PROGRESS BAR
      const volumeIcon = document.createElement('i');
      volumeIcon.className = 'bi bi-volume-up';
      volumeIcon.style.cssText = 'color: white; font-size: 0.9rem; flex-shrink: 0;';
      
      const volumeSlider = document.createElement('input');
      volumeSlider.type = 'range';
      volumeSlider.min = '0';
      volumeSlider.max = '100';
      volumeSlider.value = '100';
      volumeSlider.className = 'video-volume-slider';
      volumeSlider.style.cssText = 'cursor: pointer; height: 6px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.25); border-radius: 3px; outline: none; width: 80px; flex-shrink: 0;';
      
      volumeSlider.addEventListener('input', function() {
        video.volume = this.value / 100;
        // Update the background gradient to show fill
        const percent = (this.value / 100) * 100;
        this.style.background = `linear-gradient(to right, white 0%, white ${percent}%, rgba(255,255,255,0.25) ${percent}%, rgba(255,255,255,0.25) 100%)`;
      });
      
      // Set initial fill
      volumeSlider.style.background = 'linear-gradient(to right, white 0%, white 100%, rgba(255,255,255,0.25) 100%, rgba(255,255,255,0.25) 100%)';
      
      // Add slider thumb styling if not already added
      if (!document.head.querySelector('style[data-volume-video-slider]')) {
        const style = document.createElement('style');
        style.setAttribute('data-volume-video-slider', 'true');
        style.textContent = `
          .video-volume-slider {
            -webkit-appearance: none;
            appearance: none;
          }
          .video-volume-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: white;
            cursor: pointer;
            box-shadow: 0 0 2px rgba(0,0,0,0.5);
          }
          .video-volume-slider::-moz-range-thumb {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: white;
            cursor: pointer;
            border: none;
            box-shadow: 0 0 2px rgba(0,0,0,0.5);
          }
        `;
        document.head.appendChild(style);
      }
      
      controlsContainer.appendChild(volumeIcon);
      controlsContainer.appendChild(volumeSlider);
      
      // Create wrapper with video and controls stacked vertically
      const videoWrapper = document.createElement('div');
      videoWrapper.style.cssText = 'display: flex; flex-direction: column; border-radius: 8px; overflow: hidden;';
      videoWrapper.appendChild(videoContainer);
      videoWrapper.appendChild(controlsContainer);
      
      mediaContainer.appendChild(videoWrapper);
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
      playBtn.addEventListener('click', function() {
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
      
      audio.addEventListener('ended', function() {
        playBtn.innerHTML = '<i class="bi bi-play-fill" style="font-size: 0.9rem;"></i>';
        isPlaying = false;
      });
      
      // Update button when autoplay starts playing
      audio.addEventListener('play', function() {
        playBtn.innerHTML = '<i class="bi bi-pause-fill" style="font-size: 0.9rem;"></i>';
        isPlaying = true;
      });
      
      // Update button when audio is paused
      audio.addEventListener('pause', function() {
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
      audio.addEventListener('timeupdate', function() {
        const percent = (audio.currentTime / audio.duration) * 100;
        progress.style.width = percent + '%';
      });
      
      // Click on progress bar to seek
      progressBar.addEventListener('click', function(e) {
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * audio.duration;
      });
      
      // Draggable progress bar for audio
      let isAudioDragging = false;
      progressBar.addEventListener('mousedown', function() {
        isAudioDragging = true;
      });
      
      document.addEventListener('mousemove', function(e) {
        if (isAudioDragging && progressBar) {
          const rect = progressBar.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right) {
            const percent = (e.clientX - rect.left) / rect.width;
            audio.currentTime = percent * audio.duration;
          }
        }
      });
      
      document.addEventListener('mouseup', function() {
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
      
      audio.addEventListener('loadedmetadata', function() {
        updateTimeDisplay();
      });
      
      audio.addEventListener('timeupdate', function() {
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
      
      volumeSlider.addEventListener('input', function() {
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
      headers: { 'Content-Type': 'application/json' }
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
      showToast(data.message || 'Failed to like', 'error');
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
      headers: { 'Content-Type': 'application/json' }
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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('[POST VIEWER] Initializing...');
  
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
  
  // Stop media playback when modal closes
  const modalElement = document.getElementById('post-viewer');
  if (modalElement) {
    modalElement.addEventListener('hidden.bs.modal', function() {
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
    #post-modal-like-btn:hover, #post-modal-share-btn:hover {
      transform: scale(1.15);
    }
    #post-modal-like-btn:active, #post-modal-share-btn:active {
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
