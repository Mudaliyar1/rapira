(function(){
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

	async function openPostById(id){
		try {
			const res = await fetch(`/posts/${id}/json`);
			const data = await res.json();
			if (!data.success) {
				console.warn('Post modal: post not available', data.message || '');
				alert(data.message || 'Post not available');
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
				: `https://ui-avatars.com/api/?name=${encodeURIComponent((post.artist.stageName||'A').charAt(0).toUpperCase())}&background=4ECDC4&color=fff&bold=true&size=200`;
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
			} else {
				const video = document.createElement('video');
				video.src = post.media.url;
				video.controls = true;
				video.style.maxWidth = '100%';
				video.style.maxHeight = '70vh';
				video.style.objectFit = 'contain';
				mediaHolder.appendChild(video);
			}

			// caption + hashtags
			document.getElementById('post-caption').textContent = post.caption || '';
			const tagsEl = document.getElementById('post-hashtags');
			tagsEl.innerHTML = (post.hashtags||[]).map(t=>`<span class="me-2">#${t}</span>`).join('');

			// counts + like state
			document.getElementById('post-likes-count').textContent = post.likesCount || 0;
			document.getElementById('post-shares-count').textContent = post.shares || 0;
			const likeIcon = document.getElementById('post-like-icon');
			likeIcon.className = post.liked ? 'bi bi-heart-fill text-danger' : 'bi bi-heart';
			const likeBtn = document.getElementById('post-like-btn');
			likeBtn.innerHTML = post.liked ? '<i class="bi bi-heart-fill text-danger"></i> Unlike' : '<i class="bi bi-heart"></i> Like';
			likeBtn.disabled = false;

			const modalEl = document.getElementById('post-viewer');
			if (!modalEl) {
				console.error('Post modal element not found');
				return;
			}
			if (!window.bootstrap || !window.bootstrap.Modal) {
				console.error('Bootstrap Modal is not available on this page');
				return;
			}
			const modal = new bootstrap.Modal(modalEl);
			modal.show();
		} catch (e) {
			console.error('Open post error', e);
		}
	}

	async function toggleLike(){
		if (!currentPost) return;
		const btn = document.getElementById('post-like-btn');
		btn.disabled = true;
		try {
			const res = await fetch(`/posts/${currentPost._id}/like`, { method: 'POST' });
			const data = await res.json();
			if (data.success){
				currentPost.liked = data.liked;
				currentPost.likesCount = data.likesCount;
				document.getElementById('post-likes-count').textContent = data.likesCount;
				document.getElementById('post-like-icon').className = data.liked ? 'bi bi-heart-fill text-danger' : 'bi bi-heart';
				btn.innerHTML = data.liked ? '<i class="bi bi-heart-fill text-danger"></i> Unlike' : '<i class="bi bi-heart"></i> Like';
			}
		} catch(e){
			console.error('Like post error', e);
		} finally {
			btn.disabled = false;
		}
	}

	async function sharePost(){
		if (!currentPost) return;
		try {
			const url = `${window.location.origin}/posts/view/${currentPost._id}`;
			if (navigator.share) {
				await navigator.share({ title: 'Check out this post', url });
			} else if (navigator.clipboard) {
				await navigator.clipboard.writeText(url);
			}
			const res = await fetch(`/posts/${currentPost._id}/share`, { method: 'POST' });
			const data = await res.json();
			if (data.success) {
				currentPost.shares = data.shares;
				document.getElementById('post-shares-count').textContent = data.shares;
			}
		} catch(e){
			console.error('Share post error', e);
		}
	}

	// Event delegation for post cards
	document.addEventListener('click', function(ev) {
		const trigger = ev.target.closest('.post-card-trigger');
		if (trigger) {
			const id = trigger.getAttribute('data-post-id');
			if (id) {
				console.debug('Post card clicked -> opening modal for', id);
				openPostById(id);
			}
		}
	});

	document.addEventListener('DOMContentLoaded', function() {
		const likeBtn = document.getElementById('post-like-btn');
		const shareBtn = document.getElementById('post-share-btn');
		if (likeBtn) likeBtn.addEventListener('click', toggleLike);
		if (shareBtn) shareBtn.addEventListener('click', sharePost);
	});

	// Expose for manual triggers
	window.openPost = openPostById;
})();
