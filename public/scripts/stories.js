async function loadStories() {
  try {
    const res = await fetch('/stories/feed');
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
  try { await fetch(`/stories/${id}/view`, { method: 'POST' }); } catch {}
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
  const holder = document.getElementById('story-media');
  const caption = document.getElementById('story-caption');
  holder.innerHTML = '';
  caption.textContent = s.caption || '';
  clearTimeout(timer);

  if (s.mediaType === 'image') {
    const img = document.createElement('img');
    img.src = s.mediaUrl;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '70vh';
    holder.appendChild(img);
  } else {
    const video = document.createElement('video');
    video.src = s.mediaUrl;
    video.controls = true;
    video.style.maxWidth = '100%';
    video.style.maxHeight = '70vh';
    holder.appendChild(video);
  }

  // Update progress bars with animation restart
  const bars = document.querySelectorAll('.story-progress-bar');
  bars.forEach((bar, idx) => {
    bar.classList.remove('active', 'viewed');
    if (idx < currentIndex) {
      bar.classList.add('viewed');
    } else if (idx === currentIndex) {
      bar.classList.add('active');
      // Force animation restart by removing and readding the animation
      const fill = bar.querySelector('.story-progress-fill');
      if (fill) {
        void fill.offsetWidth; // Trigger reflow
        fill.style.animation = 'fillProgress 5s linear forwards';
      }
    }
  });

  markViewed(s.id);
  updateLikeUI(s);
  timer = setTimeout(nextStory, s.durationMs || 5000);
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
      toggleLike(currentGroup.stories[currentIndex].id);
    }
  });
});
