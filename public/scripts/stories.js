async function loadStories() {
  try {
    const res = await fetch('/stories/feed', {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
    const json = await res.json();
    if (!json.success) return;
    const bar = document.getElementById('stories-bar');
    if (!bar) return;

    // Store all groups for navigation
    allStoryGroups = json.data;

    bar.innerHTML = '';
    json.data.forEach(group => {
      const unseen = group.stories.some(s => !s.seen);
      const ring = document.createElement('div');
      ring.className = 'story-ring';
      ring.style.width = '56px';
      ring.style.height = '56px';
      ring.style.borderRadius = '50%';
      ring.style.border = unseen ? '2px solid #9b5de5' : '2px solid #666';
      ring.style.padding = '2px';
      ring.style.cursor = 'pointer';
      ring.title = group.artist.name;

      const img = document.createElement('img');
      img.src = (group.artist.profileImage && group.artist.profileImage !== '/images/default-profile.svg') ? group.artist.profileImage : `https://ui-avatars.com/api/?name=${encodeURIComponent(group.artist.name.charAt(0).toUpperCase())}&background=4ECDC4&color=fff&bold=true&size=200`;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '50%';
      ring.appendChild(img);

      ring.addEventListener('click', () => openStoryGroup(group));
      bar.appendChild(ring);
    });
  } catch (e) {
    console.error('Failed to load stories', e);
  }
}

let allStoryGroups = []; // Store all artist groups for navigation
let currentGroupIndex = 0; // Which artist we're viewing
let currentGroup = null;
let currentIndex = 0;
let timer = null;

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

function openStoryGroup(group) {
  // Find the index of this group in all groups
  currentGroupIndex = allStoryGroups.findIndex(g => g.artist._id === group.artist._id);
  currentGroup = group;
  currentIndex = 0;
  // Set artist name and image
  document.getElementById('story-artist-name').textContent = group.artist.name;
  document.getElementById('story-artist-img').src = (group.artist.profileImage && group.artist.profileImage !== '/images/default-profile.svg') ? group.artist.profileImage : `https://ui-avatars.com/api/?name=${encodeURIComponent(group.artist.name.charAt(0).toUpperCase())}&background=4ECDC4&color=fff&bold=true&size=200`;

  // Create progress bars
  const container = document.getElementById('story-progress-container');
  if (!container) {
    console.error('Progress container not found!');
    return;
  }

  container.innerHTML = '';
  console.log(`[Story] Creating ${group.stories.length} progress bars`);

  group.stories.forEach((s, idx) => {
    const bar = document.createElement('div');
    bar.className = `story-progress-bar ${idx < currentIndex ? 'viewed' : ''} ${idx === 0 ? 'active' : ''}`;
    bar.dataset.index = idx;
    bar.style.flex = '1';
    bar.style.height = '4px';
    bar.style.background = idx < currentIndex ? 'rgba(139, 69, 255, 0.95)' : (idx === 0 ? 'rgba(139, 69, 255, 0.5)' : 'rgba(139, 69, 255, 0.4)');
    bar.style.borderRadius = '3px';
    bar.style.overflow = 'hidden';
    bar.style.position = 'relative';

    const fill = document.createElement('div');
    fill.className = 'story-progress-fill';
    fill.style.height = '100%';
    fill.style.background = '#8b45ff';
    fill.style.borderRadius = '3px';
    fill.style.width = '0%';
    if (idx === 0) {
      fill.style.animation = 'fillProgress 5s linear forwards';
    }
    bar.appendChild(fill);
    container.appendChild(bar);
  });

  console.log(`[Story] Progress bars created. Container children: ${container.children.length}`);

  showStory(group.stories[currentIndex]);
  const modal = new bootstrap.Modal(document.getElementById('story-viewer'));
  modal.show();
}

async function markViewed(id) {
  try { await fetch(`/stories/${id}/view`, { method: 'POST' }); } catch { }
}

async function updateLikeUI(story) {
  const likeBtn = document.getElementById('like-story-btn');
  const likeIcon = document.getElementById('like-icon');

  if (!likeBtn || !likeIcon) return;

  // Check if current user liked this story (from story data)
  const isLiked = story.isLiked || false;
  likeIcon.className = isLiked ? 'bi bi-heart-fill text-danger' : 'bi bi-heart';
}

async function toggleLike(storyId) {
  // GUARD: Don't run on post detail page
  if (window.IS_POST_DETAIL_PAGE) {
    console.log('[STORIES.JS] Skipping - on post detail page');
    return;
  }

  try {
    const res = await fetch(`/stories/${storyId}/like`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      const likeIcon = document.getElementById('like-icon');
      likeIcon.className = data.liked ? 'bi bi-heart-fill text-danger' : 'bi bi-heart';
      // Update current story object with like status
      if (currentGroup && currentGroup.stories[currentIndex]) {
        currentGroup.stories[currentIndex].isLiked = data.liked;
        currentGroup.stories[currentIndex].likesCount = data.likesCount;
      }
    }
  } catch (e) {
    console.error('Toggle like error', e);
  }
}

function showStory(s) {
  console.log('[Stories] Rendering story:', s);
  if (!s || !s.mediaUrl) {
    console.error('[Stories] Invalid story data:', s);
    return;
  }

  const holder = document.getElementById('story-media');
  const caption = document.getElementById('story-caption');
  const timeEl = document.getElementById('story-time-ago');

  if (!holder) return;
  holder.innerHTML = '';
  caption.textContent = s.caption || '';
  if (timeEl) {
    timeEl.textContent = formatTimeAgo(s.createdAt);
  }
  clearTimeout(timer);

  // Auto-detect audio
  const url = (s.mediaUrl || '').toLowerCase();
  const isAudio = s.mediaType === 'audio' ||
    url.endsWith('.mp3') || url.endsWith('.wav') ||
    url.endsWith('.m4a') || url.includes('/audio/');

  if (s.mediaType === 'image') {
    const img = document.createElement('img');
    img.src = s.mediaUrl;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '70vh';
    img.style.objectFit = 'contain';
    holder.appendChild(img);

    updateProgressBars(5000);
    markViewed(s._id || s.id);
    updateLikeUI(s);
    timer = setTimeout(nextStory, 5000);
  } else if (isAudio) {
    // Custom Audio View
    const audioContainer = document.createElement('div');
    audioContainer.className = 'w-100 h-100 d-flex flex-column align-items-center justify-content-center p-5';
    audioContainer.style.background = 'linear-gradient(135deg, #2a2a3c, #5a293c)';
    audioContainer.style.minHeight = '450px';
    audioContainer.style.borderRadius = '15px';

    const icon = document.createElement('i');
    icon.className = 'bi bi-music-note-list text-primary mb-4';
    icon.style.fontSize = '5rem';

    // Visualizer Bars
    const viz = document.createElement('div');
    viz.className = 'd-flex gap-2 mb-5 align-items-end';
    viz.style.height = '60px';
    for (let i = 0; i < 15; i++) {
      const bar = document.createElement('div');
      bar.style.width = '6px';
      bar.style.height = '20px';
      bar.style.background = '#8b45ff';
      bar.style.border = '1px solid #fff';
      bar.style.animation = `audioPulse ${0.5 + i * 0.1}s ease-in-out infinite alternate`;
      viz.appendChild(bar);
    }

    const audio = document.createElement('audio');
    audio.src = s.mediaUrl;
    audio.autoplay = true;

    const controls = document.createElement('div');
    controls.className = 'd-flex gap-4 align-items-center mt-3';
    controls.style.zIndex = '1000';

    const pBtn = document.createElement('button');
    pBtn.className = 'btn btn-primary rounded-circle d-flex align-items-center justify-content-center';
    pBtn.style.width = '60px';
    pBtn.style.height = '60px';
    pBtn.innerHTML = '<i class="bi bi-pause-fill fs-2"></i>';
    pBtn.onclick = (e) => {
      e.stopPropagation();
      if (audio.paused) {
        audio.play();
        pBtn.innerHTML = '<i class="bi bi-pause-fill fs-2"></i>';
      } else {
        audio.pause();
        pBtn.innerHTML = '<i class="bi bi-play-fill fs-2"></i>';
      }
    };

    const sBtn = document.createElement('button');
    sBtn.className = 'btn btn-outline-light rounded-pill px-3';
    sBtn.textContent = '1x';
    sBtn.onclick = (e) => {
      e.stopPropagation();
      audio.playbackRate = audio.playbackRate === 1 ? 2 : 1;
      sBtn.textContent = audio.playbackRate + 'x';
    };

    controls.appendChild(pBtn);
    controls.appendChild(sBtn);
    audioContainer.appendChild(icon);
    audioContainer.appendChild(viz);
    audioContainer.appendChild(controls);
    audioContainer.appendChild(audio); // CRITICAL: Ensure audio is in the DOM
    holder.appendChild(audioContainer);

    audio.onloadedmetadata = () => {
      const dur = (audio.duration * 1000) / audio.playbackRate;
      updateProgressBars(dur);
      clearTimeout(timer);
      timer = setTimeout(nextStory, dur);
    };

    audio.onratechange = () => {
      const rem = (audio.duration - audio.currentTime) * 1000 / audio.playbackRate;
      clearTimeout(timer);
      timer = setTimeout(nextStory, rem);
      updateProgressBars((audio.duration * 1000) / audio.playbackRate);
    };

    // Fallback if metadata fails
    setTimeout(() => {
      if (!timer) {
        updateProgressBars(10000);
        timer = setTimeout(nextStory, 10000);
      }
    }, 3000);

    markViewed(s._id || s.id);
    updateLikeUI(s);
  } else {
    // Video
    const video = document.createElement('video');
    video.src = s.mediaUrl;
    video.autoplay = true;
    video.controls = false;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.maxWidth = '100%';
    video.style.maxHeight = '70vh';
    video.style.objectFit = 'contain';
    holder.appendChild(video);

    video.onloadedmetadata = () => {
      const dur = video.duration * 1000;
      updateProgressBars(dur);
      clearTimeout(timer);
      timer = setTimeout(nextStory, dur);
    };

    setTimeout(() => { if (!timer) timer = setTimeout(nextStory, 10000); }, 3000);

    markViewed(s._id || s.id);
    updateLikeUI(s);
  }
}

function updateProgressBars(durationMs, startMs = 0) {
  const bars = document.querySelectorAll('.story-progress-bar');
  bars.forEach((bar, idx) => {
    bar.classList.remove('active', 'viewed');
    if (idx < currentIndex) {
      bar.classList.add('viewed');
    } else if (idx === currentIndex) {
      bar.classList.add('active');
      const fill = bar.querySelector('.story-progress-fill');
      if (fill) {
        void fill.offsetWidth;
        fill.style.animation = `fillProgress ${durationMs / 1000}s linear forwards`;
        // Handle seek if startMs > 0 (not fully implemented here but structured)
      }
    }
  });
}

function nextStory() {
  if (!currentGroup) return;
  currentIndex++;
  if (currentIndex >= currentGroup.stories.length) {
    // Reached end of current artist's stories, try next artist
    currentGroupIndex++;
    if (currentGroupIndex >= allStoryGroups.length) {
      // No more artists, close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('story-viewer'));
      modal.hide();
      return;
    }
    // Move to next artist's first story with transition
    const media = document.getElementById('story-media');
    media.classList.remove('transition-in');
    media.classList.add('transition-out');

    setTimeout(() => {
      currentGroup = allStoryGroups[currentGroupIndex];
      currentIndex = 0;
      document.getElementById('story-artist-name').textContent = currentGroup.artist.name;
      document.getElementById('story-artist-img').src = (currentGroup.artist.profileImage && currentGroup.artist.profileImage !== '/images/default-profile.svg') ? currentGroup.artist.profileImage : `https://ui-avatars.com/api/?name=${encodeURIComponent(currentGroup.artist.name.charAt(0).toUpperCase())}&background=4ECDC4&color=fff&bold=true&size=200`;

      // Recreate progress bars for new artist
      const container = document.getElementById('story-progress-container');
      container.innerHTML = '';
      console.log(`[Story] Switching to artist with ${currentGroup.stories.length} stories`);
      currentGroup.stories.forEach((s, idx) => {
        const bar = document.createElement('div');
        bar.className = `story-progress-bar ${idx === 0 ? 'active' : ''}`;
        bar.dataset.index = idx;
        bar.style.flex = '1';
        bar.style.height = '4px';
        bar.style.background = idx === 0 ? 'rgba(139, 69, 255, 0.5)' : 'rgba(139, 69, 255, 0.4)';
        bar.style.borderRadius = '3px';
        bar.style.overflow = 'hidden';
        bar.style.position = 'relative';

        const fill = document.createElement('div');
        fill.className = 'story-progress-fill';
        fill.style.height = '100%';
        fill.style.background = '#8b45ff';
        fill.style.borderRadius = '3px';
        fill.style.width = '0%';
        if (idx === 0) {
          fill.style.animation = 'fillProgress 5s linear forwards';
        }
        bar.appendChild(fill);
        container.appendChild(bar);
      });

      showStory(currentGroup.stories[currentIndex]);
      media.classList.remove('transition-out');
      media.classList.add('transition-in');
    }, 250);
    return;
  }
  showStory(currentGroup.stories[currentIndex]);
}

function prevStory() {
  if (!currentGroup) return;
  currentIndex--;
  if (currentIndex < 0) {
    // Reached start of current artist's stories, try previous artist
    currentGroupIndex--;
    if (currentGroupIndex < 0) {
      // No more artists, close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('story-viewer'));
      modal.hide();
      return;
    }
    // Move to previous artist's last story with transition
    const media = document.getElementById('story-media');
    media.classList.remove('transition-in');
    media.classList.add('transition-out');

    setTimeout(() => {
      currentGroup = allStoryGroups[currentGroupIndex];
      currentIndex = currentGroup.stories.length - 1;
      document.getElementById('story-artist-name').textContent = currentGroup.artist.name;
      document.getElementById('story-artist-img').src = (currentGroup.artist.profileImage && currentGroup.artist.profileImage !== '/images/default-profile.svg') ? currentGroup.artist.profileImage : `https://ui-avatars.com/api/?name=${encodeURIComponent(currentGroup.artist.name.charAt(0).toUpperCase())}&background=4ECDC4&color=fff&bold=true&size=200`;

      // Recreate progress bars for new artist
      const container = document.getElementById('story-progress-container');
      container.innerHTML = '';
      console.log(`[Story] Switching to artist with ${currentGroup.stories.length} stories`);
      currentGroup.stories.forEach((s, idx) => {
        const bar = document.createElement('div');
        bar.className = `story-progress-bar ${idx === currentIndex ? 'active' : ''} ${idx < currentIndex ? 'viewed' : ''}`;
        bar.dataset.index = idx;
        bar.style.flex = '1';
        bar.style.height = '4px';
        bar.style.background = idx < currentIndex ? 'rgba(139, 69, 255, 0.95)' : (idx === currentIndex ? 'rgba(139, 69, 255, 0.5)' : 'rgba(139, 69, 255, 0.4)');
        bar.style.borderRadius = '3px';
        bar.style.overflow = 'hidden';
        bar.style.position = 'relative';

        const fill = document.createElement('div');
        fill.className = 'story-progress-fill';
        fill.style.height = '100%';
        fill.style.background = '#8b45ff';
        fill.style.borderRadius = '3px';
        fill.style.width = '0%';
        if (idx === currentIndex) {
          fill.style.animation = 'fillProgress 5s linear forwards';
        }
        bar.appendChild(fill);
        container.appendChild(bar);
      });

      showStory(currentGroup.stories[currentIndex]);
      media.classList.remove('transition-out');
      media.classList.add('transition-in');
    }, 250);
    return;
  }
  showStory(currentGroup.stories[currentIndex]);
}

document.addEventListener('DOMContentLoaded', () => {
  // Add keyframe animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fillProgress {
      from { width: 0%; }
      to { width: 100%; }
    }
    @keyframes audioPulse {
      0%, 100% { height: 20px; opacity: 0.5; }
      50% { height: 60px; opacity: 1; }
    }
    .v-bar {
      transition: height 0.2s ease;
    }
  `;
  document.head.appendChild(style);

  loadStories();
  const prevBtn = document.getElementById('prev-story');
  const nextBtn = document.getElementById('next-story');
  const likeBtn = document.getElementById('like-story-btn');
  if (prevBtn) prevBtn.addEventListener('click', prevStory);
  if (nextBtn) nextBtn.addEventListener('click', nextStory);
  if (likeBtn) likeBtn.addEventListener('click', () => {
    if (currentGroup && currentGroup.stories[currentIndex]) {
      const storyId = currentGroup.stories[currentIndex]._id || currentGroup.stories[currentIndex].id;
      if (storyId && storyId !== 'undefined') {
        toggleLike(storyId);
      } else {
        console.error('Story ID is undefined', currentGroup.stories[currentIndex]);
      }
    }
  });

  // Stop video/audio when story modal closes
  const storyModal = document.getElementById('story-viewer');
  if (storyModal) {
    storyModal.addEventListener('hidden.bs.modal', function () {
      // Stop any playing video
      const video = document.querySelector('#story-media video');
      if (video) {
        video.pause();
        video.currentTime = 0;
      }

      // Stop any playing audio
      const audio = document.querySelector('#story-media audio');
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }

      // Clear timer
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      console.log('[Stories] Modal closed, media stopped');
    });
  }
});
