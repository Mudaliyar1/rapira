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

// Open post in modal
async function viewPost(postId) {
  try {
    console.log('[POST VIEWER] Loading post:', postId);
    
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
      const video = document.createElement('video');
      video.src = currentPost.media.url;
      video.controls = true;
      video.style.cssText = 'max-width: 100%; max-height: 500px; width: 100%; height: auto; object-fit: contain; display: block;';
      mediaContainer.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = currentPost.media.url;
      img.alt = 'post';
      img.style.cssText = 'max-width: 100%; max-height: 500px; width: 100%; height: auto; object-fit: contain; display: block;';
      mediaContainer.appendChild(img);
    }
    
    // Update like button state
    updateLikeButton(currentPost.liked);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('post-viewer'));
    modal.show();
    
  } catch (err) {
    console.error('[POST VIEWER] Error loading post:', err);
    showToast('Failed to load post', 'error');
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
  
  const url = `${window.location.origin}/posts/view/${currentPost._id}`;
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
