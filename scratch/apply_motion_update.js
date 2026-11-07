const fs = require('fs');

const p = 'public/js/homepage-motion.js';
let js = fs.readFileSync(p, 'utf8');

const startMarker = '// ---------------------------------------------------------------------------\n  // RAPIRA Dedicated Reel Modal Viewer Controller\n  // ---------------------------------------------------------------------------';
const endMarker = '// 9. Featured Artists Mobile Swipeable Carousel Dots Sync & Dot Navigation';

const startIdx = js.indexOf(startMarker);
const endIdx = js.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Markers not found in homepage-motion.js! startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

const newControllerCode = `// ---------------------------------------------------------------------------
  // RAPIRA Dedicated Reel Modal Viewer Controller (Instagram Reels-Inspired)
  // ---------------------------------------------------------------------------
  window.rapiraHomeReels = window.rapiraHomeReels || [];
  let currentReelIndex = 0;
  let currentActiveReelId = null;
  let savedScrollY = 0;
  let isReelMuted = false;
  let lastTapTime = 0;
  let tapTimeout = null;
  let touchStartY = 0;

  // Open reel by index in window.rapiraHomeReels
  window.openRapiraReelIndex = function(idx) {
    if (!window.rapiraHomeReels || window.rapiraHomeReels.length === 0) return;
    idx = Math.max(0, Math.min(idx, window.rapiraHomeReels.length - 1));
    currentReelIndex = idx;
    savedScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    loadReel(window.rapiraHomeReels[currentReelIndex]);
  };

  // Backwards-compatible openRapiraReel
  window.openRapiraReel = function(reelId, mediaUrl, mediaType, artistName, artistImg, posterUrl, captionText) {
    if (window.rapiraHomeReels && window.rapiraHomeReels.length > 0) {
      const foundIdx = window.rapiraHomeReels.findIndex(r => String(r._id) === String(reelId));
      if (foundIdx !== -1) {
        return window.openRapiraReelIndex(foundIdx);
      }
    }
    // Fallback transient reel
    const transient = {
      _id: reelId,
      media: { url: mediaUrl, mediaType: mediaType || 'video', thumbnailUrl: posterUrl || '' },
      artist: { stageName: artistName || 'Artist', profileImage: artistImg || '/images/default-profile.svg', verified: true },
      caption: captionText || '',
      likesCount: 0,
      commentsCount: 0
    };
    savedScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    loadReel(transient);
  };

  // Internal loader
  function loadReel(reel) {
    if (!reel) return;
    currentActiveReelId = reel._id;

    const modal = document.getElementById('rhReelModal');
    const video = document.getElementById('rhReelVideo');
    const audio = document.getElementById('rhReelAudio');
    const audioStage = document.getElementById('rhReelAudioStage');
    const loader = document.getElementById('rhReelLoading');
    const errorEl = document.getElementById('rhReelError');
    const authorImg = document.getElementById('rhReelAuthorImg');
    const authorName = document.getElementById('rhReelAuthorName');
    const authorLink = document.getElementById('rhReelAuthorLink');
    const verifiedBadge = document.getElementById('rhReelVerifiedBadge');
    const captionEl = document.getElementById('rhReelCaption');
    const moreBtn = document.getElementById('rhReelMoreBtn');
    const likeCountEl = document.getElementById('rhReelLikeCount');
    const commentCountEl = document.getElementById('rhReelCommentCount');
    const drawerCountEl = document.getElementById('rhDrawerCommentCount');
    const likeIcon = document.getElementById('rhReelLikeIcon');
    const commentsDrawer = document.getElementById('rhReelCommentsDrawer');
    const externalLink = document.getElementById('rhReelExternalLink');
    const fallbackLink = document.getElementById('rhReelFallbackLink');
    const soundIcon = document.getElementById('rhReelSoundIcon');

    if (!modal) return;

    // 1. Prevent background scrolling & show full-screen overlay
    document.body.classList.add('rh-modal-open');
    modal.style.display = 'flex';

    // 2. Close comments drawer if open
    if (commentsDrawer) commentsDrawer.classList.remove('active');

    // 3. Creator info
    const stageName = (reel.artist && reel.artist.stageName) ? reel.artist.stageName : 'Artist';
    if (authorName) authorName.textContent = stageName.startsWith('@') ? stageName : '@' + stageName;
    if (authorImg) authorImg.src = (reel.artist && reel.artist.profileImage) ? reel.artist.profileImage : '/images/default-profile.svg';
    if (authorLink) authorLink.href = (reel.artist && reel.artist._id) ? '/artists/' + reel.artist._id : '#';
    if (verifiedBadge) verifiedBadge.style.display = (reel.artist && reel.artist.verified) ? 'inline-flex' : 'none';

    // 4. Caption
    if (captionEl) {
      captionEl.textContent = reel.caption || '';
      captionEl.classList.remove('expanded');
    }
    if (moreBtn) {
      moreBtn.style.display = (reel.caption && reel.caption.length > 70) ? 'inline-block' : 'none';
      moreBtn.textContent = 'more';
    }

    // 5. Engagement Counts
    const lCount = reel.likesCount || 0;
    const cCount = reel.commentsCount || 0;
    if (likeCountEl) likeCountEl.textContent = lCount;
    if (commentCountEl) commentCountEl.textContent = cCount;
    if (drawerCountEl) drawerCountEl.textContent = cCount;

    // 6. Reset Like Icon
    if (likeIcon) {
      likeIcon.className = 'bi bi-heart';
    }

    // 7. Sound state
    if (soundIcon) {
      soundIcon.className = isReelMuted ? 'bi bi-volume-mute-fill' : 'bi bi-volume-up-fill';
    }

    // 8. Navigation Links
    if (externalLink) externalLink.href = '/reels?id=' + encodeURIComponent(reel._id);
    if (fallbackLink) fallbackLink.href = '/reels?id=' + encodeURIComponent(reel._id);

    // 9. Reset media elements
    if (video) {
      video.pause();
      video.src = '';
      video.style.display = 'none';
    }
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    if (audioStage) audioStage.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    if (loader) loader.style.display = 'flex';

    // 10. Load media
    const mediaUrl = (reel.media && reel.media.url) ? reel.media.url : '';
    const mediaType = (reel.media && reel.media.mediaType) ? reel.media.mediaType : 'video';
    const isAudio = mediaType === 'audio' || (mediaUrl && (mediaUrl.endsWith('.m4a') || mediaUrl.endsWith('.mp3') || mediaUrl.endsWith('.ogg')));

    if (isAudio && mediaUrl) {
      if (loader) loader.style.display = 'none';
      if (audioStage) audioStage.style.display = 'flex';
      const audioThumb = document.getElementById('rhReelAudioThumb');
      if (audioThumb) {
        audioThumb.src = (reel.media && reel.media.thumbnailUrl) ? reel.media.thumbnailUrl : ((reel.artist && reel.artist.profileImage) ? reel.artist.profileImage : '/images/default-thumbnail.jpg');
      }
      if (audio) {
        audio.src = mediaUrl;
        audio.play().catch(function() {});
      }
    } else if (mediaUrl) {
      if (video) {
        video.style.display = 'block';
        video.muted = isReelMuted;
        if (reel.media && reel.media.thumbnailUrl) {
          video.poster = reel.media.thumbnailUrl;
        }
        video.src = mediaUrl;
        video.onloadeddata = function() {
          if (loader) loader.style.display = 'none';
        };
        video.onerror = function() {
          if (loader) loader.style.display = 'none';
          video.style.display = 'none';
          if (errorEl) errorEl.style.display = 'flex';
        };
        video.play().catch(function() {
          if (loader) loader.style.display = 'none';
        });
      }
    } else {
      if (loader) loader.style.display = 'none';
      if (errorEl) errorEl.style.display = 'flex';
    }

    // 11. Fetch fresh stats asynchronously if not mock
    if (reel._id && !String(reel._id).startsWith('mock-')) {
      fetch('/posts/' + reel._id + '/json?_ts=' + Date.now(), { cache: 'no-store' })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data && data.success && data.post) {
            const p = data.post;
            if (likeCountEl) likeCountEl.textContent = p.likesCount || (p.likes ? p.likes.length : 0);
            if (commentCountEl) commentCountEl.textContent = p.comments ? p.comments.length : 0;
            if (drawerCountEl) drawerCountEl.textContent = p.comments ? p.comments.length : 0;
            if (p.caption && captionEl && !reel.caption) captionEl.textContent = p.caption;
            if (likeIcon && p.liked) {
              likeIcon.className = 'bi bi-heart-fill text-danger';
            }
          }
        })
        .catch(function(err) {
          console.error('Error fetching reel stats:', err);
        });
    }
  }

  // Close Reel Modal
  window.closeRapiraReelModal = function() {
    const modal = document.getElementById('rhReelModal');
    const video = document.getElementById('rhReelVideo');
    const audio = document.getElementById('rhReelAudio');

    if (video) {
      video.pause();
      video.currentTime = 0;
      video.src = '';
    }
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
    }

    if (modal) modal.style.display = 'none';
    document.body.classList.remove('rh-modal-open');
    if (savedScrollY) {
      window.scrollTo({ top: savedScrollY, behavior: 'instant' });
    }
    currentActiveReelId = null;
  };

  // Vertical Navigation (Previous/Next)
  window.navReel = function(delta) {
    if (!window.rapiraHomeReels || window.rapiraHomeReels.length <= 1) return;
    let nextIdx = currentReelIndex + delta;
    if (nextIdx < 0) nextIdx = window.rapiraHomeReels.length - 1;
    else if (nextIdx >= window.rapiraHomeReels.length) nextIdx = 0;
    currentReelIndex = nextIdx;
    loadReel(window.rapiraHomeReels[currentReelIndex]);
  };

  // Sound Toggle
  window.toggleReelMute = function() {
    isReelMuted = !isReelMuted;
    const video = document.getElementById('rhReelVideo');
    if (video) video.muted = isReelMuted;
    const icon = document.getElementById('rhReelSoundIcon');
    if (icon) {
      icon.className = isReelMuted ? 'bi bi-volume-mute-fill' : 'bi bi-volume-up-fill';
    }
  };

  // Caption Expand/Collapse Toggle
  window.toggleReelCaption = function() {
    const captionEl = document.getElementById('rhReelCaption');
    const moreBtn = document.getElementById('rhReelMoreBtn');
    if (!captionEl || !moreBtn) return;
    const isExpanded = captionEl.classList.toggle('expanded');
    moreBtn.textContent = isExpanded ? 'less' : 'more';
  };

  // Like Reel
  window.toggleCurrentReelLike = async function() {
    const icon = document.getElementById('rhReelLikeIcon');
    const count = document.getElementById('rhReelLikeCount');
    if (!icon) return;

    const isLiked = icon.classList.contains('bi-heart-fill');
    if (isLiked) {
      icon.classList.remove('bi-heart-fill', 'text-danger');
      icon.classList.add('bi-heart');
      if (count) count.textContent = Math.max(0, (parseInt(count.textContent) || 1) - 1);
    } else {
      icon.classList.remove('bi-heart');
      icon.classList.add('bi-heart-fill', 'text-danger');
      if (count) count.textContent = (parseInt(count.textContent) || 0) + 1;
    }

    if (currentActiveReelId && !String(currentActiveReelId).startsWith('mock-')) {
      try {
        const res = await fetch('/posts/' + currentActiveReelId + '/like', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        if (res.status === 401) {
          // Revert optimistic UI
          if (isLiked) {
            icon.classList.remove('bi-heart');
            icon.classList.add('bi-heart-fill', 'text-danger');
            if (count) count.textContent = (parseInt(count.textContent) || 0) + 1;
          } else {
            icon.classList.remove('bi-heart-fill', 'text-danger');
            icon.classList.add('bi-heart');
            if (count) count.textContent = Math.max(0, (parseInt(count.textContent) || 1) - 1);
          }
          alert('Please login to like this reel.');
        } else if (res.ok) {
          const data = await res.json();
          if (data && data.success && count) {
            count.textContent = data.likesCount;
          }
        }
      } catch (err) {
        console.error('Error toggling like:', err);
      }
    }
  };

  // Comment Drawer Toggle
  window.toggleReelComments = function() {
    const drawer = document.getElementById('rhReelCommentsDrawer');
    if (!drawer) return;
    const isOpening = !drawer.classList.contains('active');
    drawer.classList.toggle('active');
    if (isOpening) {
      loadReelComments(currentActiveReelId);
    }
  };

  // Fetch and Render Reel Comments
  async function loadReelComments(reelId) {
    const list = document.getElementById('rhDrawerCommentsList');
    const countEl = document.getElementById('rhDrawerCommentCount');
    if (!list) return;

    if (!reelId || String(reelId).startsWith('mock-')) {
      list.innerHTML = '<div class="text-center py-4 text-white-50 small"><i class="bi bi-chat-square-dots fs-3 d-block mb-2"></i>No comments yet. Start the conversation!</div>';
      return;
    }

    list.innerHTML = '<div class="text-center py-4 text-white-50 small"><div class="spinner-border spinner-border-sm text-danger me-2"></div>Loading comments...</div>';

    try {
      const res = await fetch('/posts/' + reelId + '/comments');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.comments && data.comments.length > 0) {
          if (countEl) countEl.textContent = data.comments.length;
          list.innerHTML = data.comments.map(function(c) {
            const userName = (c.user && c.user.name) ? c.user.name : 'User';
            const userImg = (c.user && c.user.profileImage) ? c.user.profileImage : '/images/default-profile.svg';
            const timeAgo = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '';
            return '<div class="rh-comment-item">' +
              '<img src="' + userImg + '" class="rh-comment-avatar" alt="' + userName + '">' +
              '<div class="rh-comment-content">' +
                '<span class="rh-comment-user">' + userName + '</span>' +
                '<p class="rh-comment-text">' + (c.text || '') + '</p>' +
                (timeAgo ? '<span class="rh-comment-time">' + timeAgo + '</span>' : '') +
              '</div>' +
            '</div>';
          }).join('');
        } else {
          list.innerHTML = '<div class="text-center py-4 text-white-50 small"><i class="bi bi-chat-square-dots fs-3 d-block mb-2"></i>No comments yet. Start the conversation!</div>';
        }
      } else {
        list.innerHTML = '<div class="text-center py-4 text-white-50 small">Unable to load comments.</div>';
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
      list.innerHTML = '<div class="text-center py-4 text-white-50 small">Error loading comments.</div>';
    }
  }

  // Submit Comment
  window.submitReelComment = async function(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('rhCommentInput');
    const list = document.getElementById('rhDrawerCommentsList');
    const commentCountEl = document.getElementById('rhReelCommentCount');
    const drawerCountEl = document.getElementById('rhDrawerCommentCount');

    if (!input || !input.value.trim()) return;
    const text = input.value.trim();

    if (!currentActiveReelId || String(currentActiveReelId).startsWith('mock-')) {
      // Mock submit
      const newCommentHtml = '<div class="rh-comment-item">' +
        '<img src="/images/default-profile.svg" class="rh-comment-avatar" alt="You">' +
        '<div class="rh-comment-content">' +
          '<span class="rh-comment-user">You</span>' +
          '<p class="rh-comment-text">' + text + '</p>' +
          '<span class="rh-comment-time">Just now</span>' +
        '</div>' +
      '</div>';
      if (list) {
        if (list.innerHTML.includes('No comments yet')) list.innerHTML = '';
        list.insertAdjacentHTML('afterbegin', newCommentHtml);
      }
      const newCount = (parseInt(drawerCountEl ? drawerCountEl.textContent : '0') || 0) + 1;
      if (commentCountEl) commentCountEl.textContent = newCount;
      if (drawerCountEl) drawerCountEl.textContent = newCount;
      input.value = '';
      return;
    }

    try {
      const res = await fetch('/posts/' + currentActiveReelId + '/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ text: text })
      });

      if (res.status === 401) {
        alert('Please login to post a comment.');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.comment) {
          const c = data.comment;
          const userName = (c.user && c.user.name) ? c.user.name : 'You';
          const userImg = (c.user && c.user.profileImage) ? c.user.profileImage : '/images/default-profile.svg';
          const newCommentHtml = '<div class="rh-comment-item">' +
            '<img src="' + userImg + '" class="rh-comment-avatar" alt="' + userName + '">' +
            '<div class="rh-comment-content">' +
              '<span class="rh-comment-user">' + userName + '</span>' +
              '<p class="rh-comment-text">' + (c.text || text) + '</p>' +
              '<span class="rh-comment-time">Just now</span>' +
            '</div>' +
          '</div>';

          if (list) {
            if (list.innerHTML.includes('No comments yet')) list.innerHTML = '';
            list.insertAdjacentHTML('afterbegin', newCommentHtml);
          }
          const updatedCount = (parseInt(drawerCountEl ? drawerCountEl.textContent : '0') || 0) + 1;
          if (commentCountEl) commentCountEl.textContent = updatedCount;
          if (drawerCountEl) drawerCountEl.textContent = updatedCount;
          input.value = '';
        }
      } else {
        alert('Unable to submit comment at this time.');
      }
    } catch (err) {
      console.error('Error posting comment:', err);
      alert('Network error while posting comment.');
    }
  };

  // Share Reel
  window.shareCurrentReel = function() {
    const url = window.location.origin + '/reels?id=' + encodeURIComponent(currentActiveReelId || '');
    if (navigator.share) {
      navigator.share({
        title: 'Rapira Reel',
        text: 'Check out this music reel on Rapira!',
        url: url
      }).catch(function() {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function() {
        alert('Reel link copied to clipboard!');
      });
    } else {
      window.open(url, '_blank');
    }
  };

  // Wire Tap Zone Gesture Handlers (Single Tap: Play/Pause, Double Tap: Like)
  function initReelGestures() {
    const tapZone = document.getElementById('rhReelTapZone');
    const heartFeedback = document.getElementById('rhReelDoubleTapHeart');
    const centerFeedback = document.getElementById('rhReelCenterFeedback');
    const feedbackIcon = document.getElementById('rhReelFeedbackIcon');
    const video = document.getElementById('rhReelVideo');

    if (tapZone) {
      tapZone.addEventListener('click', function(e) {
        const now = Date.now();
        const delta = now - lastTapTime;

        if (delta < 300) {
          // Double Tap: Like + Heart Pop
          clearTimeout(tapTimeout);
          tapTimeout = null;
          window.toggleCurrentReelLike();
          if (heartFeedback) {
            heartFeedback.classList.remove('pop');
            void heartFeedback.offsetWidth; // trigger reflow
            heartFeedback.classList.add('pop');
            setTimeout(function() { heartFeedback.classList.remove('pop'); }, 800);
          }
        } else {
          // Single Tap: Play/Pause with center indicator
          tapTimeout = setTimeout(function() {
            if (video && video.src) {
              if (video.paused) {
                video.play().catch(function() {});
                if (feedbackIcon) feedbackIcon.className = 'bi bi-play-fill';
              } else {
                video.pause();
                if (feedbackIcon) feedbackIcon.className = 'bi bi-pause-fill';
              }
              if (centerFeedback) {
                centerFeedback.classList.add('show');
                setTimeout(function() { centerFeedback.classList.remove('show'); }, 500);
              }
            }
          }, 280);
        }
        lastTapTime = now;
      });

      // Mobile Touch Vertical Swipe Navigation
      tapZone.addEventListener('touchstart', function(e) {
        if (e.touches && e.touches[0]) {
          touchStartY = e.touches[0].clientY;
        }
      }, { passive: true });

      tapZone.addEventListener('touchend', function(e) {
        if (e.changedTouches && e.changedTouches[0]) {
          const deltaY = e.changedTouches[0].clientY - touchStartY;
          if (Math.abs(deltaY) > 55) {
            window.navReel(deltaY < 0 ? 1 : -1);
          }
        }
      }, { passive: true });
    }
  }

  // Keyboard navigation
  document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('rhReelModal');
    if (!modal || modal.style.display === 'none') return;

    if (e.key === 'Escape' || e.key === 'Esc') {
      window.closeRapiraReelModal();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      window.navReel(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      window.navReel(1);
    }
  });

  // Initialize gestures when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReelGestures);
  } else {
    initReelGestures();
  }

  `;

const updatedJs = js.substring(0, startIdx) + newControllerCode + js.substring(endIdx);
fs.writeFileSync(p, updatedJs, 'utf8');
console.log('Successfully updated homepage-motion.js!');

