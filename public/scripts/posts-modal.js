(function () {
	let currentPost = null;

	function formatTimeAgo(dateString) {
		if (!dateString) return '';
		const date = new Date(dateString);
		const diffMs = Date.now() - date.getTime();
		const mins = Math.floor(diffMs / 60000);
		if (mins < 1) return 'Just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	async function openPostById(id) {
		try {
			// Show modal with loading state immediately
			const modalEl = document.getElementById('post-viewer');
			if (modalEl) {
				// Clear previous content and show loading state
				const mediaHolder = document.getElementById('post-media');
				const captionEl = document.getElementById('post-caption');
				const tagsEl = document.getElementById('post-hashtags');
				const likesEl = document.getElementById('post-likes-count');
				const sharesEl = document.getElementById('post-shares-count');

				if (mediaHolder) mediaHolder.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></div>';
				if (captionEl) captionEl.textContent = '';
				if (tagsEl) tagsEl.innerHTML = '';
				if (likesEl) likesEl.textContent = '0';
				if (sharesEl) sharesEl.textContent = '0';

				// Update like icon to default state
				const likeIcon = document.getElementById('post-like-icon');
				if (likeIcon) likeIcon.className = 'bi bi-heart';

				// Show modal immediately
				if (window.bootstrap && window.bootstrap.Modal) {
					const modal = new bootstrap.Modal(modalEl);
					modal.show();
				}
			}

			const res = await fetch(`/posts/${id}/json?_ts=${Date.now()}`, {
				headers: { 'X-Requested-With': 'XMLHttpRequest' },
				cache: 'no-store'
			});
			const data = await res.json();
			if (!data.success) {
				console.warn('Post modal: post not available', data.message || '');
				alert(data.message || 'Post not available');
				// Hide modal on error
				if (modalEl && window.bootstrap && window.bootstrap.Modal) {
					const modal = bootstrap.Modal.getInstance(modalEl);
					if (modal) modal.hide();
				}
				return;
			}
			const post = data.post;
			currentPost = post;

			// header
			const artistImg = document.getElementById('post-artist-img');
			const artistName = document.getElementById('post-artist-name');
			const timeAgo = document.getElementById('post-time-ago');
			artistImg.src = (post.artist.profileImage && post.artist.profileImage !== '/images/default-profile.svg')
				? post.artist.profileImage
				: `https://ui-avatars.com/api/?name=${encodeURIComponent((post.artist.stageName || 'A').charAt(0).toUpperCase())}&background=4ECDC4&color=fff&bold=true&size=200`;
			artistName.textContent = post.artist.stageName || 'Artist';
			timeAgo.textContent = formatTimeAgo(post.createdAt);

			// media
			const mediaHolder = document.getElementById('post-media');
			mediaHolder.innerHTML = '';
			if (post.media.mediaType === 'image') {
				const img = document.createElement('img');
				img.src = post.media.url;
				img.style.maxWidth = '100%';
				img.style.maxHeight = '70vh';
				img.style.objectFit = 'contain';
				mediaHolder.appendChild(img);
			} else if (post.media.mediaType === 'video') {
				// Create video container
				const videoContainer = document.createElement('div');
				videoContainer.style.cssText = 'position: relative; background: black; border-radius: 8px; overflow: hidden;';

				// Video element (without controls)
				const video = document.createElement('video');
				video.src = post.media.url; video.autoplay = true; video.style.cssText = 'width: 100%; height: auto; display: block; max-height: 70vh;';
				videoContainer.appendChild(video);

				// Custom controls overlay
				const controlsOverlay = document.createElement('div');
				controlsOverlay.style.cssText = 'position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.8)); padding: 15px; display: flex; align-items: center; gap: 10px;';

				// Play/Pause button
				const playBtn = document.createElement('button');
				playBtn.innerHTML = '<i class="bi bi-play-fill" style="font-size: 1.2rem;"></i>';
				playBtn.style.cssText = 'background: white; border: none; color: #333; cursor: pointer; padding: 8px 12px; border-radius: 4px; font-size: 1.2rem; display: flex; align-items: center; justify-content: center;';

				let isPlaying = false;
				playBtn.addEventListener('click', function () {
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

				video.addEventListener('play', function () {
					playBtn.innerHTML = '<i class="bi bi-pause-fill" style="font-size: 1.2rem;"></i>';
					isPlaying = true;
				});

				video.addEventListener('pause', function () {
					playBtn.innerHTML = '<i class="bi bi-play-fill" style="font-size: 1.2rem;"></i>';
					isPlaying = false;
				});

				controlsOverlay.appendChild(playBtn);

				// Progress bar
				const progressBar = document.createElement('div');
				progressBar.style.cssText = 'flex: 1; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; cursor: pointer; position: relative;';

				const progress = document.createElement('div');
				progress.style.cssText = 'height: 100%; background: #ff006e; border-radius: 2px; width: 0%;';
				progressBar.appendChild(progress);

				// Update progress bar
				video.addEventListener('timeupdate', function () {
					const percent = (video.currentTime / video.duration) * 100;
					progress.style.width = percent + '%';
				});

				// Click on progress bar to seek
				progressBar.addEventListener('click', function (e) {
					const rect = progressBar.getBoundingClientRect();
					const percent = (e.clientX - rect.left) / rect.width;
					video.currentTime = percent * video.duration;
				});

				controlsOverlay.appendChild(progressBar);

				// Time display
				const timeDisplay = document.createElement('span');
				timeDisplay.textContent = '0:00 / 0:00';
				timeDisplay.style.cssText = 'color: white; font-size: 0.85rem; font-weight: bold; min-width: 60px;';

				function formatTime(seconds) {
					if (isNaN(seconds)) return '0:00';
					const mins = Math.floor(seconds / 60);
					const secs = Math.floor(seconds % 60);
					return mins + ':' + (secs < 10 ? '0' : '') + secs;
				}

				video.addEventListener('loadedmetadata', function () {
					updateTimeDisplay();
				});

				video.addEventListener('timeupdate', function () {
					updateTimeDisplay();
				});

				function updateTimeDisplay() {
					const current = formatTime(video.currentTime);
					const duration = formatTime(video.duration);
					timeDisplay.textContent = current + ' / ' + duration;
				}

				controlsOverlay.appendChild(timeDisplay);

				videoContainer.appendChild(controlsOverlay);
				mediaHolder.appendChild(videoContainer);
			} else if (post.media.mediaType === 'audio') {
				// Create audio player container
				const audioContainer = document.createElement('div');
				audioContainer.style.cssText = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px 30px; border-radius: 12px; text-align: center; min-height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; width: 100%;';

				const icon = document.createElement('i');
				icon.className = 'bi bi-music-note-beamed';
				icon.style.cssText = 'font-size: 4rem; color: white; display: block;';
				audioContainer.appendChild(icon);

				const label = document.createElement('div');
				label.textContent = 'Audio Post';
				label.style.cssText = 'color: white; font-weight: 600; font-size: 1.3rem; letter-spacing: 0.5px;';
				audioContainer.appendChild(label);

				const audio = document.createElement('audio');
				audio.src = post.media.url; audio.autoplay = true; audio.style.cssText = 'display: none;';
				audioContainer.appendChild(audio);

				const playerContainer = document.createElement('div');
				playerContainer.style.cssText = 'display: flex; align-items: center; gap: 12px; width: 100%; max-width: 380px;';

				const playBtn = document.createElement('button');
				playBtn.innerHTML = '<i class="bi bi-play-fill" style="font-size: 0.9rem;"></i>';
				playBtn.style.cssText = 'background: white; border: none; color: #667eea; cursor: pointer; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; flex-shrink: 0; font-size: 0.9rem;';

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

				audio.addEventListener('play', function () {
					playBtn.innerHTML = '<i class="bi bi-pause-fill" style="font-size: 0.9rem;"></i>';
					isPlaying = true;
				});

				audio.addEventListener('pause', function () {
					playBtn.innerHTML = '<i class="bi bi-play-fill" style="font-size: 0.9rem;"></i>';
					isPlaying = false;
				});

				audio.addEventListener('ended', function () {
					playBtn.innerHTML = '<i class="bi bi-play-fill" style="font-size: 0.9rem;"></i>';
					isPlaying = false;
				});

				playerContainer.appendChild(playBtn);

				const progressContainer = document.createElement('div');
				progressContainer.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 4px;';

				const progressBar = document.createElement('div');
				progressBar.style.cssText = 'height: 3px; background: rgba(255,255,255,0.25); border-radius: 2px; cursor: pointer; position: relative; overflow: hidden;';

				const progress = document.createElement('div');
				progress.style.cssText = 'height: 100%; background: white; border-radius: 2px; width: 0%;';
				progressBar.appendChild(progress);

				audio.addEventListener('timeupdate', function () {
					const percent = (audio.currentTime / audio.duration) * 100;
					progress.style.width = percent + '%';
				});

				progressBar.addEventListener('click', function (e) {
					const rect = progressBar.getBoundingClientRect();
					const percent = (e.clientX - rect.left) / rect.width;
					audio.currentTime = percent * audio.duration;
				});

				progressContainer.appendChild(progressBar);

				const timeDisplay = document.createElement('div');
				timeDisplay.style.cssText = 'color: rgba(255,255,255,0.8); font-size: 0.75rem; font-weight: 500; text-align: center;';

				function formatTime(seconds) {
					if (isNaN(seconds)) return '0:00';
					const mins = Math.floor(seconds / 60);
					const secs = Math.floor(seconds % 60);
					return mins + ':' + (secs < 10 ? '0' : '') + secs;
				}

				audio.addEventListener('timeupdate', function () {
					timeDisplay.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
				});

				progressContainer.appendChild(timeDisplay);
				playerContainer.appendChild(progressContainer);
				audioContainer.appendChild(playerContainer);
				mediaHolder.appendChild(audioContainer);
			}

			// caption + hashtags
			document.getElementById('post-caption').textContent = post.caption || '';
			const tagsEl = document.getElementById('post-hashtags');
			tagsEl.innerHTML = (post.hashtags || []).map(t => `<span class="me-2">#${t}</span>`).join('');

			// counts + like state
			document.getElementById('post-likes-count').textContent = post.likesDisplay || post.fakeLikesLabel || post.likesCount || 0;
			document.getElementById('post-shares-count').textContent = post.shares || 0;
			document.getElementById('post-views-count').textContent = post.fakeViewsLabel || post.viewsDisplay || post.views || 0;
			const likeIcon = document.getElementById('post-like-icon');
			if (likeIcon) likeIcon.className = post.liked ? 'bi bi-heart-fill text-danger' : 'bi bi-heart';

			const likeBtn = document.getElementById('post-like-btn');
			if (likeBtn) {
				likeBtn.innerHTML = post.liked ? '<i class="bi bi-heart-fill text-danger"></i> Unlike' : '<i class="bi bi-heart"></i> Like';
				likeBtn.disabled = false;
			}
		} catch (e) {
			console.error('Open post error', e);
			const modalEl = document.getElementById('post-viewer');
			if (modalEl && window.bootstrap && window.bootstrap.Modal) {
				const modal = bootstrap.Modal.getInstance(modalEl);
				if (modal) modal.hide();
			}
		}
	}

	async function toggleLike() {
		if (!currentPost) return;
		const btn = document.getElementById('post-like-btn');
		if (!btn) return;
		btn.disabled = true;
		try {
			const res = await fetch(`/posts/${currentPost._id}/like`, {
				method: 'POST',
				headers: { 'X-Requested-With': 'XMLHttpRequest' }
			});
			const data = await res.json();
			if (data.success) {
				currentPost.liked = data.liked;
				currentPost.likesCount = data.likesCount;
				currentPost.fakeLikesLabel = data.fakeLikesLabel || currentPost.fakeLikesLabel || '';
				currentPost.likesDisplay = data.likesDisplay || currentPost.likesDisplay || String(data.likesCount || 0);
				document.getElementById('post-likes-count').textContent = currentPost.likesDisplay || currentPost.fakeLikesLabel || data.likesCount;
				const likeIcon = document.getElementById('post-like-icon');
				if (likeIcon) likeIcon.className = data.liked ? 'bi bi-heart-fill text-danger' : 'bi bi-heart';
				btn.innerHTML = data.liked ? '<i class="bi bi-heart-fill text-danger"></i> Unlike' : '<i class="bi bi-heart"></i> Like';
			}
		} catch (e) {
			console.error('Like post error', e);
		} finally {
			btn.disabled = false;
		}
	}

	async function sharePost() {
		if (!currentPost) return;
		try {
			const url = `${window.location.origin}#view-post-${currentPost._id}`;
			if (navigator.share) {
				await navigator.share({ title: 'Check out this post', url });
			} else if (navigator.clipboard) {
				await navigator.clipboard.writeText(url);
			}
			const res = await fetch(`/posts/${currentPost._id}/share`, {
				method: 'POST',
				headers: { 'X-Requested-With': 'XMLHttpRequest' }
			});
			const data = await res.json();
			if (data.success) {
				currentPost.shares = data.shares;
				document.getElementById('post-shares-count').textContent = data.shares;
			}
		} catch (e) {
			console.error('Share post error', e);
		}
	}

	function stopMediaPlayback() {
		const mediaHolder = document.getElementById('post-media');
		if (mediaHolder) {
			const audios = mediaHolder.querySelectorAll('audio');
			const videos = mediaHolder.querySelectorAll('video');
			audios.forEach(audio => { audio.pause(); audio.currentTime = 0; });
			videos.forEach(video => { video.pause(); video.currentTime = 0; });
		}
	}

	document.addEventListener('click', function (ev) {
		const trigger = ev.target.closest('.post-card-trigger');
		if (trigger) {
			const id = trigger.getAttribute('data-post-id');
			if (id) {
				openPostById(id);
			}
		}
	});

	document.addEventListener('DOMContentLoaded', function () {
		const likeBtn = document.getElementById('post-like-btn');
		const shareBtn = document.getElementById('post-share-btn');
		if (likeBtn) likeBtn.addEventListener('click', toggleLike);
		if (shareBtn) shareBtn.addEventListener('click', sharePost);
		const modalEl = document.getElementById('post-viewer');
		if (modalEl) {
			modalEl.addEventListener('hidden.bs.modal', function () {
				stopMediaPlayback();
			});
		}
	});

	window.openPost = openPostById;
})();
