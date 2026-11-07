/**
 * RAPIRA - Unified Reel Viewer Controller
 * Single source of truth for Reels playback, interactions, and feed navigation
 * Shared across Homepage and Discover -> Reels (/reels)
 */

(function initRapiraReelViewer() {
  'use strict';

  if (window.__rapiraReelViewerLoaded) return;
  window.__rapiraReelViewerLoaded = true;

  console.log('[RAPIRA REEL VIEWER] Initializing unified controller...');

  // State
  let currentReelIndex = 0;
  let currentActiveReelId = null;
  let isReelMuted = localStorage.getItem('rapira_reel_muted') === 'true';
  let isReelHistoryPushed = false;
  let savedScrollY = 0;
  let lastTapTime = 0;
  let tapTimeout = null;
  let touchStartY = 0;
  let lastWheelTime = 0;

  // Cache Reels Data
  window.getRapiraReels = function() {
    if (window.rapiraReelsData && Array.isArray(window.rapiraReelsData) && window.rapiraReelsData.length > 0) {
      return window.rapiraReelsData;
    }
    if (window.rapiraHomeReels && Array.isArray(window.rapiraHomeReels) && window.rapiraHomeReels.length > 0) {
      return window.rapiraHomeReels;
    }
    // Fallback: parse from homepage cards if present
    const cards = document.querySelectorAll('.rh-reel-card');
    if (cards && cards.length > 0) {
      window.rapiraReelsData = Array.from(cards).map(function(c, i) {
        return {
          _id: c.dataset.reelId || 'reel-' + i,
          media: {
            url: c.dataset.mediaUrl || '',
            mediaType: c.dataset.mediaType || 'video',
            thumbnailUrl: c.dataset.posterUrl || ''
          },
          artist: {
            _id: c.dataset.artistId || '',
            stageName: c.dataset.artistName || 'Artist',
            profileImage: c.dataset.artistImg || '/images/default-profile.svg',
            verified: c.dataset.verified === 'true'
          },
          caption: c.dataset.caption || '',
          likesCount: parseInt(c.dataset.likes, 10) || 0,
          commentsCount: parseInt(c.dataset.comments, 10) || 0
        };
      });
      return window.rapiraReelsData;
    }
    return [];
  };

  // Open reel directly from clicked card element
  window.openRapiraReelCard = function(cardEl) {
    if (!cardEl) return;
    const idx = parseInt(cardEl.dataset.reelIndex, 10);
    window.openRapiraReelIndex(isNaN(idx) ? 0 : idx);
  };

  // Open reel by index in getRapiraReels()
  window.openRapiraReelIndex = function(idx) {
    const reels = window.getRapiraReels();
    if (!reels || reels.length === 0) return;
    idx = Math.max(0, Math.min(idx, reels.length - 1));
    currentReelIndex = idx;
    savedScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    loadReel(reels[currentReelIndex]);
  };

  // Open reel by ID
  window.openRapiraReelById = function(reelId) {
    const reels = window.getRapiraReels();
    if (!reels || reels.length === 0) return;
    const idx = reels.findIndex(r => String(r._id) === String(reelId));
    window.openRapiraReelIndex(idx !== -1 ? idx : 0);
  };

  // Show Toast Notice
  function showReelNotice(msg) {
    let toast = document.getElementById('rhReelToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'rhReelToast';
      toast.className = 'rh-reel-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function() {
      toast.classList.remove('show');
    }, 2400);
  }

  // Flash Temporary Center Feedback (Play/Pause)
  function showCenterFeedback(type) {
    const centerFeedback = document.getElementById('rhReelCenterFeedback');
    const feedbackIcon = document.getElementById('rhReelFeedbackIcon');
    if (!centerFeedback || !feedbackIcon) return;

    feedbackIcon.className = type === 'play' ? 'bi bi-play-fill' : 'bi bi-pause-fill';
    centerFeedback.classList.remove('show');
    void centerFeedback.offsetWidth; // trigger reflow
    centerFeedback.classList.add('show');
    clearTimeout(centerFeedback._timer);
    centerFeedback._timer = setTimeout(function() {
      centerFeedback.classList.remove('show');
    }, 500);
  }

  // Update Play/Pause UI according to REAL video state
  function updatePlayPauseUI(isPaused) {
    const stage = document.getElementById('rhReelStage');
    const playPauseIcon = document.getElementById('rhReelPlayPauseIcon');

    if (stage) {
      if (isPaused) {
        stage.classList.remove('is-playing');
        stage.classList.add('is-paused');
      } else {
        stage.classList.remove('is-paused');
        stage.classList.add('is-playing');
      }
    }

    if (playPauseIcon) {
      playPauseIcon.className = isPaused ? 'bi bi-play-fill' : 'bi bi-pause-fill';
    }
  }

  // Core Play/Pause Toggle Function
  window.toggleReelPlayPause = function() {
    const video = document.getElementById('rhReelVideo');
    const audio = document.getElementById('rhReelAudio');
    const isAudioStage = document.getElementById('rhReelAudioStage')?.style.display !== 'none';
    const media = isAudioStage ? audio : video;

    if (!media || !media.src) return;

    if (media.paused) {
      media.play().then(() => {
        showCenterFeedback('play');
      }).catch(err => {
        console.warn('[RAPIRA REELS] Play was prevented by browser:', err);
      });
    } else {
      media.pause();
      showCenterFeedback('pause');
    }
  };

  // Sound Mute Toggle Function
  window.toggleReelMute = function() {
    isReelMuted = !isReelMuted;
    try {
      localStorage.setItem('rapira_reel_muted', isReelMuted ? 'true' : 'false');
    } catch (e) {}

    const video = document.getElementById('rhReelVideo');
    if (video) video.muted = isReelMuted;

    const soundIcon = document.getElementById('rhReelSoundIcon');
    if (soundIcon) {
      soundIcon.className = isReelMuted ? 'bi bi-volume-mute-fill' : 'bi bi-volume-up-fill';
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

  // Internal Loader for a given Reel Object
  function loadReel(reel) {
    if (!reel) return;
    currentActiveReelId = reel._id;

    const modal = document.getElementById('rhReelModal');
    const stage = document.getElementById('rhReelStage');
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
    const soundIcon = document.getElementById('rhReelSoundIcon');

    if (!modal) return;

    // 1. Prevent background scrolling & show full-screen overlay
    document.body.classList.add('rh-modal-open');
    const wasClosed = modal.style.display !== 'flex';
    modal.style.display = 'flex';
    modal.classList.add('is-open');

    // Push or replace browser history state for Back button support
    try {
      if (wasClosed && !window.isReelsStandalonePage) {
        history.pushState({ rapiraReelOpen: true, reelId: reel._id }, '', '#reel-' + encodeURIComponent(reel._id));
        isReelHistoryPushed = true;
      } else if (!window.isReelsStandalonePage) {
        history.replaceState({ rapiraReelOpen: true, reelId: reel._id }, '', '#reel-' + encodeURIComponent(reel._id));
      }
    } catch (e) {}

    // Ensure global loaders are hidden
    if (window.loaderManager) {
      window.loaderManager.hide();
    }

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

    // 6. Like Icon & Button State
    const likeBtn = document.getElementById('rhReelLikeBtn');
    if (likeBtn) {
      likeBtn.classList.toggle('is-liked', !!reel.liked);
    }
    if (likeIcon) {
      likeIcon.className = reel.liked ? 'bi bi-heart-fill text-danger' : 'bi bi-heart';
    }

    // 7. Sound state
    if (soundIcon) {
      soundIcon.className = isReelMuted ? 'bi bi-volume-mute-fill' : 'bi bi-volume-up-fill';
    }

    // 8. Navigation Links
    if (externalLink) externalLink.href = '/reels?id=' + encodeURIComponent(reel._id);

    // 9. Reset media elements
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.style.display = 'none';
    }
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    if (audioStage) audioStage.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    if (loader) loader.style.display = 'flex';

    updatePlayPauseUI(true);

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
        audio.play().then(() => updatePlayPauseUI(false)).catch(() => updatePlayPauseUI(true));
      }
    } else if (mediaUrl) {
      if (video) {
        video.style.display = 'block';
        video.muted = isReelMuted;
        if (reel.media && reel.media.thumbnailUrl) {
          video.poster = reel.media.thumbnailUrl;
        }
        video.src = mediaUrl;
        video.play().then(() => {
          if (loader) loader.style.display = 'none';
          updatePlayPauseUI(false);
        }).catch(err => {
          if (loader) loader.style.display = 'none';
          updatePlayPauseUI(true);
        });
      }
    } else {
      if (loader) loader.style.display = 'none';
      if (errorEl) errorEl.style.display = 'flex';
      updatePlayPauseUI(true);
    }

    // 11. Fetch fresh stats asynchronously if real post
    if (reel._id && !String(reel._id).startsWith('mock-')) {
      fetch('/posts/' + reel._id + '/json?_ts=' + Date.now(), { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
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
        .catch(err => console.warn('Error fetching fresh reel stats:', err));
    }
  }

  // Close Reel Modal
  window.closeRapiraReelModal = function(popHistory) {
    if (popHistory === undefined) popHistory = true;

    // Standalone page handling (/reels): return to homepage or previous page
    if (window.isReelsStandalonePage) {
      const video = document.getElementById('rhReelVideo');
      const audio = document.getElementById('rhReelAudio');
      if (video) try { video.pause(); } catch (e) {}
      if (audio) try { audio.pause(); } catch (e) {}

      if (document.referrer && document.referrer.includes(window.location.host) && !document.referrer.includes('/reels')) {
        window.location.href = document.referrer;
      } else {
        window.location.href = '/';
      }
      return;
    }

    const modal = document.getElementById('rhReelModal');
    const video = document.getElementById('rhReelVideo');
    const audio = document.getElementById('rhReelAudio');
    const loader = document.getElementById('rhReelLoading');
    const errorEl = document.getElementById('rhReelError');

    // 1. Fully pause, unload and cleanup media to stop background playback
    if (video) {
      try {
        video.pause();
        video.currentTime = 0;
        video.removeAttribute('src');
        video.load();
      } catch (e) {}
      video.style.display = 'none';
      video.onloadeddata = null;
      video.onerror = null;
    }
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute('src');
        audio.load();
      } catch (e) {}
    }

    // 2. Hide modal and reset modal state
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('is-open');
    }
    if (loader) loader.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    document.body.classList.remove('rh-modal-open');

    // 3. Immediately dismiss any stuck global loading overlays and classes
    if (window.loaderManager) {
      window.loaderManager.hide();
    }
    const globalOverlay = document.getElementById('loading-overlay');
    if (globalOverlay) {
      globalOverlay.classList.remove('active');
    }
    document.querySelectorAll('.is-loading, .btn-loading, .loading').forEach(function(el) {
      el.classList.remove('is-loading', 'btn-loading', 'loading');
    });

    // 4. Handle browser history cleanup
    if (popHistory && isReelHistoryPushed && window.location.hash.startsWith('#reel-')) {
      try {
        if (window.history.state && window.history.state.rapiraReelOpen) {
          history.back();
        } else {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      } catch (e) {}
    }
    isReelHistoryPushed = false;

    // 5. Restore saved scroll position
    if (savedScrollY) {
      window.scrollTo({ top: savedScrollY, behavior: 'instant' });
    }
    currentActiveReelId = null;
  };

  // Feed Navigation (Previous / Next Reel)
  window.navReel = function(delta) {
    const reels = window.getRapiraReels();
    if (!reels || reels.length <= 1) return;

    // Pause previous video immediately before switching
    const video = document.getElementById('rhReelVideo');
    const audio = document.getElementById('rhReelAudio');
    if (video) try { video.pause(); } catch (e) {}
    if (audio) try { audio.pause(); } catch (e) {}

    let nextIdx = currentReelIndex + delta;
    if (nextIdx < 0) nextIdx = reels.length - 1;
    else if (nextIdx >= reels.length) nextIdx = 0;

    currentReelIndex = nextIdx;
    loadReel(reels[currentReelIndex]);
  };

  // Like Reel Toggle
  window.toggleCurrentReelLike = async function() {
    const btn = document.getElementById('rhReelLikeBtn');
    const icon = document.getElementById('rhReelLikeIcon');
    const count = document.getElementById('rhReelLikeCount');
    if (!icon) return;

    const isLiked = icon.classList.contains('bi-heart-fill') || (btn && btn.classList.contains('is-liked'));
    if (isLiked) {
      if (btn) btn.classList.remove('is-liked');
      icon.classList.remove('bi-heart-fill', 'text-danger');
      icon.classList.add('bi-heart');
      if (count) count.textContent = Math.max(0, (parseInt(count.textContent, 10) || 1) - 1);
    } else {
      if (btn) btn.classList.add('is-liked');
      icon.classList.remove('bi-heart');
      icon.classList.add('bi-heart-fill', 'text-danger');
      if (count) count.textContent = (parseInt(count.textContent, 10) || 0) + 1;
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
            if (btn) btn.classList.add('is-liked');
            icon.classList.remove('bi-heart');
            icon.classList.add('bi-heart-fill', 'text-danger');
            if (count) count.textContent = (parseInt(count.textContent, 10) || 0) + 1;
          } else {
            if (btn) btn.classList.remove('is-liked');
            icon.classList.remove('bi-heart-fill', 'text-danger');
            icon.classList.add('bi-heart');
            if (count) count.textContent = Math.max(0, (parseInt(count.textContent, 10) || 1) - 1);
          }
          showReelNotice('Please login to like this reel.');
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
    const isOpening = !drawer.classList.contains('active') && !drawer.classList.contains('is-open');
    drawer.classList.toggle('active');
    drawer.classList.toggle('is-open');
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
      const newCount = (parseInt(drawerCountEl ? drawerCountEl.textContent : '0', 10) || 0) + 1;
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
        showReelNotice('Please login to post a comment.');
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
          const updatedCount = (parseInt(drawerCountEl ? drawerCountEl.textContent : '0', 10) || 0) + 1;
          if (commentCountEl) commentCountEl.textContent = updatedCount;
          if (drawerCountEl) drawerCountEl.textContent = updatedCount;
          input.value = '';
        }
      } else {
        showReelNotice('Unable to submit comment at this time.');
      }
    } catch (err) {
      console.error('Error posting comment:', err);
      showReelNotice('Network error while posting comment.');
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
        showReelNotice('Reel link copied to clipboard!');
      });
    } else {
      window.open(url, '_blank');
    }
  };

  // Bind Native HTML5 Media Events
  function initMediaEvents() {
    const video = document.getElementById('rhReelVideo');
    const audio = document.getElementById('rhReelAudio');
    const loader = document.getElementById('rhReelLoading');
    const errorEl = document.getElementById('rhReelError');

    if (video) {
      video.addEventListener('play', () => updatePlayPauseUI(false));
      video.addEventListener('pause', () => updatePlayPauseUI(true));
      video.addEventListener('playing', () => {
        if (loader) loader.style.display = 'none';
        updatePlayPauseUI(false);
      });
      video.addEventListener('waiting', () => {
        if (loader) loader.style.display = 'flex';
      });
      video.addEventListener('canplay', () => {
        if (loader) loader.style.display = 'none';
      });
      video.addEventListener('ended', () => {
        // Auto-loop smoothly
        video.currentTime = 0;
        video.play().catch(() => updatePlayPauseUI(true));
      });
      video.addEventListener('error', () => {
        if (loader) loader.style.display = 'none';
        if (errorEl) errorEl.style.display = 'flex';
        updatePlayPauseUI(true);
      });
    }

    if (audio) {
      audio.addEventListener('play', () => updatePlayPauseUI(false));
      audio.addEventListener('pause', () => updatePlayPauseUI(true));
    }
  }

  // Wire Tap Zone Gesture Handlers (Single Tap: Play/Pause, Double Tap: Like)
  function initReelGestures() {
    const tapZone = document.getElementById('rhReelTapZone');
    const heartFeedback = document.getElementById('rhReelDoubleTapHeart');

    if (tapZone) {
      tapZone.addEventListener('click', function(e) {
        const now = Date.now();
        const delta = now - lastTapTime;

        if (delta < 280) {
          // Double Tap: Like + Heart Pop
          clearTimeout(tapTimeout);
          tapTimeout = null;
          window.toggleCurrentReelLike();
          if (heartFeedback) {
            heartFeedback.classList.remove('pop');
            void heartFeedback.offsetWidth;
            heartFeedback.classList.add('pop');
            setTimeout(function() { heartFeedback.classList.remove('pop'); }, 800);
          }
        } else {
          // Single Tap: Play/Pause toggle
          tapTimeout = setTimeout(function() {
            window.toggleReelPlayPause();
          }, 240);
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

    // Mouse Wheel Navigation (Debounced)
    const stage = document.getElementById('rhReelStage');
    if (stage) {
      stage.addEventListener('wheel', function(e) {
        const drawer = document.getElementById('rhReelCommentsDrawer');
        if (drawer && drawer.classList.contains('active')) return; // don't scroll reels while commenting
        const now = Date.now();
        if (now - lastWheelTime < 450) return;
        if (Math.abs(e.deltaY) > 35) {
          lastWheelTime = now;
          window.navReel(e.deltaY > 0 ? 1 : -1);
        }
      }, { passive: true });
    }
  }

  // Keyboard navigation
  document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('rhReelModal');
    if (!modal || modal.style.display === 'none') return;

    // Ignore keyboard shortcuts if typing in comment input
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

    if (e.key === 'Escape' || e.key === 'Esc') {
      window.closeRapiraReelModal();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      window.navReel(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      window.navReel(1);
    } else if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      window.toggleReelPlayPause();
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      window.toggleReelMute();
    }
  });

  // Listen for browser Back button (popstate)
  window.addEventListener('popstate', function(e) {
    const modal = document.getElementById('rhReelModal');
    if (modal && modal.style.display !== 'none' && !window.isReelsStandalonePage) {
      window.closeRapiraReelModal(false);
    }
    if (window.loaderManager) {
      window.loaderManager.hide();
    }
  });

  // Lifecycle: Pause video when user switches browser tab
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      const video = document.getElementById('rhReelVideo');
      const audio = document.getElementById('rhReelAudio');
      if (video && !video.paused) {
        video.pause();
      }
      if (audio && !audio.paused) {
        audio.pause();
      }
    }
  });

  // Lifecycle: Pause video when navigating away
  window.addEventListener('pagehide', function() {
    const video = document.getElementById('rhReelVideo');
    const audio = document.getElementById('rhReelAudio');
    if (video) try { video.pause(); } catch (e) {}
    if (audio) try { audio.pause(); } catch (e) {}
  });

  // DOM Content Loaded Initializer
  function initialize() {
    initMediaEvents();
    initReelGestures();

    // Auto-open target reel if URL hash is present (#reel-ID) or standalone page
    if (window.isReelsStandalonePage) {
      const reels = window.getRapiraReels();
      if (reels && reels.length > 0) {
        let targetIdx = 0;
        if (window.rapiraTargetPostId) {
          const found = reels.findIndex(r => String(r._id) === String(window.rapiraTargetPostId));
          if (found !== -1) targetIdx = found;
        }
        window.openRapiraReelIndex(targetIdx);
      }
    } else if (window.location.hash && window.location.hash.startsWith('#reel-')) {
      const targetId = decodeURIComponent(window.location.hash.replace('#reel-', ''));
      if (targetId) {
        window.openRapiraReelById(targetId);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  console.log('[RAPIRA REEL VIEWER] Unified controller ready.');
})();
