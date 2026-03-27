const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { isLoggedIn } = require('../middleware/auth');
const Artist = require('../models/Artist');
const ArtistPost = require('../models/ArtistPost');
const { uploadFileToCloudinary, deleteMedia } = require('../utils/mediaService');

const getViewsDisplay = (postLike) => {
	const fake = String(postLike?.fakeViewsLabel || '').trim();
	if (fake) return fake;
	return String(postLike?.views || 0);
};

const getLikesDisplay = (postLike) => {
	const fake = String(postLike?.fakeLikesLabel || '').trim();

	const parseCompactLabel = (label) => {
		const normalized = String(label || '').trim().replace(/\s+/g, '');
		if (!normalized) return null;
		const match = normalized.match(/^(\d+(?:\.\d+)?)([kKmMbBtT]?)$/);
		if (!match) return null;
		const value = parseFloat(match[1]);
		if (!Number.isFinite(value)) return null;
		const suffix = (match[2] || '').toUpperCase();
		const multipliers = { '': 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
		return value * (multipliers[suffix] || 1);
	};

	const formatCompact = (num) => {
		const safeNum = Math.max(0, Number(num) || 0);
		const round2 = (v) => {
			const r = Number(v.toFixed(2));
			return Number.isInteger(r) ? String(r) : String(r);
		};

		if (safeNum >= 1e12) return `${round2(safeNum / 1e12)}T`;
		if (safeNum >= 1e9) return `${round2(safeNum / 1e9)}B`;
		if (safeNum >= 1e6) return `${round2(safeNum / 1e6)}M`;
		if (safeNum >= 1e3) return `${round2(safeNum / 1e3)}K`;
		return round2(safeNum);
	};

	const realLikes = Number(postLike?.likesCount || 0);
	const fakeBase = parseCompactLabel(fake);

	if (fakeBase !== null) {
		return formatCompact(fakeBase + realLikes);
	}

	return formatCompact(realLikes);
};

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
	fileFilter: (req, file, cb) => {
		// Allow any mimetype that starts with image, video, or audio
		const isImage = file.mimetype.startsWith('image/');
		const isVideo = file.mimetype.startsWith('video/');
		const isAudio = file.mimetype.startsWith('audio/');

		if (isImage || isVideo || isAudio) {
			return cb(null, true);
		}
		cb(new Error('Invalid file type. Only image, video, and audio files are allowed.'));
	}
});

// === ARTIST ROUTES ===

// Create post with error handling wrapper for multer
router.post('/posts', isLoggedIn, (req, res, next) => {
	upload.single('media')(req, res, (err) => {
		if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
			return res.status(400).json({ success: false, message: 'file exceed limit please under 100mb' });
		} else if (err) {
			return res.status(400).json({ success: false, message: err.message });
		}
		next();
	});
}, async (req, res) => {
	try {
		console.log('[POST /posts] Starting upload...');

		if (req.session.user.role !== 'artist') {
			return res.status(403).json({ success: false, message: 'Only artists can create posts' });
		}

		const artist = await Artist.findOne({ user: req.session.user.id });
		if (!artist) {
			return res.status(404).json({ success: false, message: 'Artist profile not found' });
		}

		if (!req.file) {
			return res.status(400).json({ success: false, message: 'Please upload an image, video, or audio file' });
		}

		const isImage = req.file.mimetype.startsWith('image/');
		const isVideo = req.file.mimetype.startsWith('video/');
		const isAudio = req.file.mimetype.startsWith('audio/');

		if (!isImage && !isVideo && !isAudio) {
			return res.status(400).json({ success: false, message: 'Only image/video/audio files allowed' });
		}

		let folder = 'rapira/artist-posts/images';
		let mediaType = 'image';

		if (isVideo) {
			folder = 'rapira/artist-posts/videos';
			mediaType = 'video';
		} else if (isAudio) {
			folder = 'rapira/artist-posts/audio';
			mediaType = 'audio';
		}

		const uploadRes = await uploadFileToCloudinary(req.file, {
			folder,
			module: 'artistPost',
			ownerType: 'artist',
			ownerId: artist._id
		});

		if (!uploadRes.media || !uploadRes.result) {
			return res.status(500).json({ success: false, message: 'Upload to Cloudinary failed' });
		}

		const caption = req.body.caption || '';
		const hashtags = caption.match(/#\w+/g) || [];

		const post = new ArtistPost({
			artist: artist._id,
			media: {
				url: uploadRes.media.secure_url || uploadRes.result.secure_url,
				mediaType: mediaType,
				publicId: uploadRes.media.public_id || uploadRes.result.public_id
			},
			caption,
			hashtags: hashtags.map(tag => tag.substring(1).toLowerCase()),
			isApproved: true // Auto-approve post
		});

		await post.save();
		res.json({ success: true, post, message: 'Post created successfully and is now public!' });
	} catch (err) {
		console.error('[POST /posts] ERROR:', err.message);
		res.status(500).json({ success: false, message: err.message || 'Failed to create post' });
	}
});

// Get artist's own posts
router.get('/my-posts', isLoggedIn, async (req, res) => {
	try {
		if (req.session.user.role !== 'artist') {
			return res.status(403).json({ success: false, message: 'Not authorized' });
		}

		const artist = await Artist.findOne({ user: req.session.user.id });
		if (!artist) {
			return res.status(404).json({ success: false, message: 'Artist profile not found' });
		}

		const posts = await ArtistPost.find({ artist: artist._id })
			.sort({ createdAt: -1 })
			.limit(100);

		// Format posts consistently
		const formattedPosts = posts.map(post => {
			const postObj = post.toObject();
			return {
				_id: postObj._id,
				caption: postObj.caption || '',
				hashtags: Array.isArray(postObj.hashtags) ? postObj.hashtags : [],
				media: {
					url: postObj.media?.url || '',
					mediaType: postObj.media?.mediaType || postObj.mediaType || 'image',
					publicId: postObj.media?.publicId || ''
				},
				likes: postObj.likes || [],
				likesCount: postObj.likesCount || 0,
				fakeLikesLabel: postObj.fakeLikesLabel || '',
				likesDisplay: getLikesDisplay(postObj),
				shares: postObj.shares || 0,
				views: postObj.views || 0,
				viewsDisplay: getViewsDisplay(postObj),
				createdAt: postObj.createdAt,
				isApproved: postObj.isApproved,
				isActive: postObj.isActive,
				rejectionReason: postObj.rejectionReason
			};
		});

		res.json({ success: true, posts: formattedPosts });
	} catch (err) {
		console.error('[GET /my-posts] ERROR:', err);
		res.status(500).json({ success: false, message: err.message || 'Failed to fetch posts' });
	}
});

// Get artist's public posts
router.get('/artist/:artistId/posts', async (req, res) => {
	try {
		const artist = await Artist.findById(req.params.artistId);
		if (!artist) return res.status(404).json({ success: false, message: 'Artist not found' });

		const posts = await ArtistPost.find({
			artist: artist._id,
			isActive: true
		})
			.populate('likes', 'name profileImage')
			.sort({ createdAt: -1 })
			.limit(50);

		const formattedPosts = posts.map(post => {
			const postObj = post.toObject();
			return {
				_id: postObj._id,
				caption: postObj.caption || '',
				hashtags: Array.isArray(postObj.hashtags) ? postObj.hashtags : [],
				media: {
					url: postObj.media?.url || '',
					mediaType: postObj.media?.mediaType || 'image',
					publicId: postObj.media?.publicId || ''
				},
				likes: postObj.likes || [],
				likesCount: postObj.likesCount || 0,
				fakeLikesLabel: postObj.fakeLikesLabel || '',
				likesDisplay: getLikesDisplay(postObj),
				shares: postObj.shares || 0,
				views: postObj.views || 0, // Add views to response
				viewsDisplay: getViewsDisplay(postObj),
				createdAt: postObj.createdAt,
				isApproved: postObj.isApproved,
				isActive: postObj.isActive
			};
		});

		res.json({ success: true, posts: formattedPosts });
	} catch (err) {
		res.status(500).json({ success: false });
	}
});

// Update post caption
router.put('/posts/:id', isLoggedIn, async (req, res) => {
	try {
		const post = await ArtistPost.findById(req.params.id);
		if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

		const artist = await Artist.findOne({ user: req.session.user.id });
		if (!artist || post.artist.toString() !== artist._id.toString()) {
			return res.status(403).json({ success: false, message: 'Not authorized' });
		}

		const caption = req.body.caption || '';
		const hashtags = caption.match(/#\w+/g) || [];

		post.caption = caption;
		post.hashtags = hashtags.map(tag => tag.substring(1).toLowerCase());
		post.updatedAt = new Date();
		await post.save();

		const wantsJson = req.xhr || req.is('application/json') || (req.headers.accept && req.headers.accept.includes('application/json'));
		if (wantsJson) {
			return res.json({ success: true, post, message: 'Post updated' });
		}

		// HTML form flow
		if (req.flash) req.flash('success', 'Post updated');
		return res.redirect('/artists/manage-posts');
	} catch (err) {
		if (req.xhr || req.is('application/json')) {
			return res.status(500).json({ success: false });
		}
		if (req.flash) req.flash('error', 'Failed to update post');
		return res.redirect('/artists/manage-posts');
	}
});

// Delete post
router.delete('/posts/:id', isLoggedIn, async (req, res) => {
	try {
		const post = await ArtistPost.findById(req.params.id);
		if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

		const artist = await Artist.findOne({ user: req.session.user.id });
		if (!artist || post.artist.toString() !== artist._id.toString()) {
			return res.status(403).json({ success: false, message: 'Not authorized' });
		}

		if (post.media && post.media.publicId) {
			await deleteMedia([post.media.publicId]);
		}

		await ArtistPost.findByIdAndDelete(req.params.id);

		const wantsJson = req.xhr || req.is('application/json') || (req.headers.accept && req.headers.accept.includes('application/json'));
		if (wantsJson) {
			return res.json({ success: true, message: 'Post deleted' });
		}

		if (req.flash) req.flash('success', 'Post deleted');
		return res.redirect('/artists/manage-posts');
	} catch (err) {
		if (req.xhr || req.is('application/json')) {
			return res.status(500).json({ success: false });
		}
		if (req.flash) req.flash('error', 'Failed to delete post');
		return res.redirect('/artists/manage-posts');
	}
});

// Like post
router.post('/posts/:id/like', isLoggedIn, async (req, res) => {
	try {
		console.log('[POST LIKE] Request received for post ID:', req.params.id);
		console.log('[POST LIKE] User ID:', req.session.user?.id);

		const post = await ArtistPost.findById(req.params.id);
		if (!post || !post.isActive) {
			console.log('[POST LIKE] Post not found or inactive');
			return res.status(404).json({ success: false, message: 'Post not found' });
		}

		const userId = req.session.user.id.toString();
		const alreadyLiked = post.likes.some(l => l.toString() === userId);
		console.log('[POST LIKE] Already liked:', alreadyLiked);

		if (alreadyLiked) {
			post.likes = post.likes.filter(l => l.toString() !== userId);
			post.likesCount = Math.max(0, post.likesCount - 1);
		} else {
			post.likes.push(userId);
			post.likesCount += 1;
		}

		await post.save();
		console.log('[POST LIKE] Success! New like count:', post.likesCount);
		res.json({
			success: true,
			liked: !alreadyLiked,
			likesCount: post.likesCount,
			fakeLikesLabel: post.fakeLikesLabel || '',
			likesDisplay: getLikesDisplay(post)
		});
	} catch (err) {
		console.error('[POST LIKE] Error:', err);
		res.status(500).json({ success: false, message: err.message });
	}
});

// Get likes
router.get('/posts/:id/likes', async (req, res) => {
	try {
		const post = await ArtistPost.findById(req.params.id)
			.populate('likes', 'name profileImage role');
		if (!post) return res.status(404).json({ success: false });

		res.json({ success: true, likes: post.likes, likesCount: post.likesCount });
	} catch (err) {
		res.status(500).json({ success: false });
	}
});

// Share post
router.post('/posts/:id/share', async (req, res) => {
	try {
		const post = await ArtistPost.findByIdAndUpdate(
			req.params.id,
			{ $inc: { shares: 1 } },
			{ new: true }
		);
		res.json({ success: true, shares: post.shares });
	} catch (err) {
		res.status(500).json({ success: false });
	}
});

// View post (increments view count)
router.post('/posts/:id/view', async (req, res) => {
	try {
		const post = await ArtistPost.findByIdAndUpdate(
			req.params.id,
			{ $inc: { views: 1 } },
			{ new: true }
		);
		res.json({ success: true, views: post.views, viewsDisplay: getViewsDisplay(post) });
	} catch (err) {
		res.status(500).json({ success: false });
	}
});

// JSON endpoint for single post (for modal rendering)
router.get('/posts/:id/json', async (req, res) => {
	try {
		res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
		res.set('Pragma', 'no-cache');
		res.set('Expires', '0');
		res.set('Surrogate-Control', 'no-store');

		const post = await ArtistPost.findById(req.params.id)
			.populate({
				path: 'artist',
				select: 'stageName user',
				populate: {
					path: 'user',
					select: 'name profileImage'
				}
			})
			.populate('likes', 'name profileImage');

		if (!post || !post.isActive) {
			return res.status(404).json({ success: false, message: 'Post not available' });
		}

		// Increment view count
		post.views = (post.views || 0) + 1;
		await post.save();

		const userId = req.session?.user?.id?.toString();
		const liked = userId ? post.likes.some(l => (l._id || l).toString() === userId) : false;

		const formatted = {
			_id: post._id,
			caption: post.caption || '',
			hashtags: Array.isArray(post.hashtags) ? post.hashtags : [],
			media: {
				url: post.media?.url || '',
				mediaType: post.media?.mediaType || 'image',
				publicId: post.media?.publicId || ''
			},
			likesCount: post.likesCount || 0,
			fakeLikesLabel: post.fakeLikesLabel || '',
			likesDisplay: getLikesDisplay(post),
			shares: post.shares || 0,
			views: post.views || 0, // Include views in response
			fakeViewsLabel: post.fakeViewsLabel || '',
			viewsDisplay: getViewsDisplay(post),
			createdAt: post.createdAt,
			artist: {
				_id: post.artist?._id,
				stageName: post.artist?.stageName || '',
				profileImage: post.artist?.user?.profileImage || '/images/default-profile.svg'
			},
			liked
		};

		res.json({ success: true, post: formatted });
	} catch (err) {
		console.error('[POST JSON] Error:', err);
		res.status(500).json({ success: false });
	}
});

// Get post likes
router.get('/posts/:id/likes', async (req, res) => {
	try {
		console.log('[POST LIKES] Request for post ID:', req.params.id);

		const post = await ArtistPost.findById(req.params.id)
			.populate('likes', 'name profileImage');

		if (!post) {
			console.log('[POST LIKES] Post not found for ID:', req.params.id);
			return res.status(404).json({ success: false, message: 'Post not found' });
		}

		console.log('[POST LIKES] Found post with', post.likes.length, 'likes');

		// Format likes data
		const formattedLikes = post.likes.map(user => ({
			name: user.name || 'Anonymous User',
			profileImage: user.profileImage || '/images/default-profile.svg'
		}));

		res.json({ success: true, likes: formattedLikes });
	} catch (err) {
		console.error('[POST LIKES] Error:', err);
		res.status(500).json({ success: false, message: 'Failed to load likes: ' + err.message });
	}
});

// Get post reports (Admin/Artist only)
router.get('/posts/:id/reports', isLoggedIn, async (req, res) => {
	try {
		const post = await ArtistPost.findById(req.params.id)
			.populate('reports.user', 'name profileImage');
		if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

		const isArtist = await Artist.exists({ _id: post.artist, user: req.session.user.id });
		if (!isArtist && req.session.user.role !== 'admin') {
			return res.status(403).json({ success: false, message: 'Not authorized' });
		}

		res.json({ success: true, reports: post.reports });
	} catch (err) {
		console.error('[GET REPORTS] Error:', err);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Post a report on a post
router.post('/posts/:id/report', isLoggedIn, async (req, res) => {
	try {
		const { reason } = req.body;
		if (!reason) return res.status(400).json({ success: false, message: 'Reason is required' });

		const post = await ArtistPost.findById(req.params.id);
		if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

		// Append the report
		post.reports.push({
			user: req.session.user.id,
			reason: reason,
			createdAt: new Date()
		});

		await post.save();
		res.json({ success: true, message: 'Post reported successfully' });
	} catch (err) {
		console.error('[POST REPORT] Error:', err);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Get post comments
router.get('/posts/:id/comments', async (req, res) => {
	try {
		const post = await ArtistPost.findById(req.params.id)
			.populate('comments.user', 'name profileImage')
			.populate('comments.replies.user', 'name profileImage');
		if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

		let comments = post.comments || [];

		const isArtist = req.session.user ? await Artist.exists({ _id: post.artist, user: req.session.user.id }) : false;
		const isAdmin = req.session.user && req.session.user.role === 'admin';

		if (!isArtist && !isAdmin) {
			comments = comments.filter(c => !c.isHidden || (req.session.user && c.user && c.user._id.toString() === req.session.user.id));
		}

		// Sort: pinned first, then by date descending
		comments.sort((a, b) => {
			if (a.isPinned && !b.isPinned) return -1;
			if (!a.isPinned && b.isPinned) return 1;
			return new Date(b.createdAt) - new Date(a.createdAt);
		});

		res.json({ success: true, comments });
	} catch (err) {
		console.error('[GET COMMENTS] Error:', err);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Add a comment to a post
router.post('/posts/:id/comments', isLoggedIn, async (req, res) => {
	try {
		const { text } = req.body;
		if (!text) return res.status(400).json({ success: false, message: 'Comment text is required' });

		const post = await ArtistPost.findById(req.params.id);
		if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

		post.comments.push({
			user: req.session.user.id,
			text: text,
			createdAt: new Date()
		});

		await post.save();

		await post.populate('comments.user', 'name profileImage');
		const newComment = post.comments[post.comments.length - 1];

		res.json({ success: true, comment: newComment });
	} catch (err) {
		console.error('[POST COMMENT] Error:', err);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Pin/Unpin a comment (Artist/Admin only)
router.put('/posts/:id/comments/:commentId/pin', isLoggedIn, async (req, res) => {
	try {
		const post = await ArtistPost.findById(req.params.id);
		if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

		const isArtist = await Artist.exists({ _id: post.artist, user: req.session.user.id });
		if (!isArtist && req.session.user.role !== 'admin') {
			return res.status(403).json({ success: false, message: 'Not authorized' });
		}

		const comment = post.comments.id(req.params.commentId);
		if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

		// Only one pinned comment allowed, unpin others if pinning
		if (!comment.isPinned) {
			post.comments.forEach(c => c.isPinned = false);
		}

		comment.isPinned = !comment.isPinned;
		await post.save();

		res.json({ success: true, isPinned: comment.isPinned });
	} catch (err) {
		console.error('[PIN COMMENT] Error:', err);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Hide/Unhide a comment (Artist/Admin only)
router.put('/posts/:id/comments/:commentId/hide', isLoggedIn, async (req, res) => {
	try {
		const post = await ArtistPost.findById(req.params.id);
		if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

		const isArtist = await Artist.exists({ _id: post.artist, user: req.session.user.id });
		if (!isArtist && req.session.user.role !== 'admin') {
			return res.status(403).json({ success: false, message: 'Not authorized' });
		}

		const comment = post.comments.id(req.params.commentId);
		if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

		comment.isHidden = !comment.isHidden;
		await post.save();

		res.json({ success: true, isHidden: comment.isHidden });
	} catch (err) {
		console.error('[HIDE COMMENT] Error:', err);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Delete a comment
router.delete('/posts/:id/comments/:commentId', isLoggedIn, async (req, res) => {
	try {
		const post = await ArtistPost.findById(req.params.id);
		if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

		const comment = post.comments.id(req.params.commentId);
		if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

		const isArtist = await Artist.exists({ _id: post.artist, user: req.session.user.id });
		if (!isArtist && req.session.user.role !== 'admin' && comment.user.toString() !== req.session.user.id) {
			return res.status(403).json({ success: false, message: 'Not authorized' });
		}

		post.comments.pull(req.params.commentId);
		await post.save();

		res.json({ success: true, message: 'Comment deleted' });
	} catch (err) {
		console.error('[DELETE COMMENT] Error:', err);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Edit a comment
router.put('/posts/:id/comments/:commentId', isLoggedIn, async (req, res) => {
	try {
		const { text } = req.body;
		if (!text) return res.status(400).json({ success: false, message: 'Text is required' });

		const post = await ArtistPost.findById(req.params.id);
		if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

		const comment = post.comments.id(req.params.commentId);
		if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

		if (comment.user.toString() !== req.session.user.id) {
			return res.status(403).json({ success: false, message: 'Not authorized' });
		}

		comment.text = text;
		await post.save();

		res.json({ success: true, message: 'Comment updated' });
	} catch (err) {
		console.error('[EDIT COMMENT] Error:', err);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Reply to a comment
router.post('/posts/:id/comments/:commentId/replies', isLoggedIn, async (req, res) => {
	try {
		const { text } = req.body;
		if (!text) return res.status(400).json({ success: false, message: 'Text is required' });

		const post = await ArtistPost.findById(req.params.id);
		if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

		const comment = post.comments.id(req.params.commentId);
		if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

		comment.replies.push({
			user: req.session.user.id,
			text
		});

		await post.save();
		res.json({ success: true, message: 'Reply added' });
	} catch (err) {
		console.error('[REPLY COMMENT] Error:', err);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Edit a reply
router.put('/posts/:id/comments/:commentId/replies/:replyId', isLoggedIn, async (req, res) => {
	try {
		const { text } = req.body;
		if (!text) return res.status(400).json({ success: false, message: 'Text is required' });

		const post = await ArtistPost.findById(req.params.id);
		if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

		const comment = post.comments.id(req.params.commentId);
		if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

		const reply = comment.replies.id(req.params.replyId);
		if (!reply) return res.status(404).json({ success: false, message: 'Reply not found' });

		if (reply.user.toString() !== req.session.user.id) {
			return res.status(403).json({ success: false, message: 'Not authorized' });
		}

		reply.text = text;
		await post.save();

		res.json({ success: true, message: 'Reply updated' });
	} catch (err) {
		console.error('[EDIT REPLY] Error:', err);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Delete a reply
router.delete('/posts/:id/comments/:commentId/replies/:replyId', isLoggedIn, async (req, res) => {
	try {
		const post = await ArtistPost.findById(req.params.id);
		if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

		const comment = post.comments.id(req.params.commentId);
		if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

		const reply = comment.replies.id(req.params.replyId);
		if (!reply) return res.status(404).json({ success: false, message: 'Reply not found' });

		const isArtist = await Artist.exists({ _id: post.artist, user: req.session.user.id });
		if (!isArtist && req.session.user.role !== 'admin' && reply.user.toString() !== req.session.user.id) {
			return res.status(403).json({ success: false, message: 'Not authorized' });
		}

		comment.replies.pull(req.params.replyId);
		await post.save();

		res.json({ success: true, message: 'Reply deleted' });
	} catch (err) {
		console.error('[DELETE REPLY] Error:', err);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// === ADMIN ROUTES ===

// Get all posts for admin
router.get('/admin/posts', isLoggedIn, async (req, res) => {
	try {
		if (req.session.user.role !== 'admin') {
			return res.status(403).json({ success: false, message: 'Not authorized' });
		}

		const posts = await ArtistPost.find()
			.populate('artist', 'stageName user')
			.populate('likes', 'name')
			.sort({ createdAt: -1 })
			.limit(100);

		const normalizedPosts = posts.map(doc => {
			const post = doc.toObject();
			const media = post.media || {};

			if (typeof media === 'string') {
				post.media = { url: media, mediaType: 'image' };
			} else {
				post.media = {
					url: media.url,
					mediaType: media.mediaType || media.type || 'image',
					publicId: media.publicId
				};
			}

			// Ensure all posts have views property
			if (typeof post.views !== 'number') {
				post.views = 0;
			}

			return post;
		});

		res.json({ success: true, posts: normalizedPosts });
	} catch (err) {
		res.status(500).json({ success: false });
	}
});

// Admin approve/reject post
router.put('/admin/posts/:id/approve', isLoggedIn, async (req, res) => {
	try {
		if (req.session.user.role !== 'admin') {
			return res.status(403).json({ success: false, message: 'Not authorized' });
		}

		const { isApproved, rejectionReason } = req.body;
		const post = await ArtistPost.findByIdAndUpdate(
			req.params.id,
			{
				isApproved,
				rejectionReason: isApproved ? undefined : rejectionReason,
				approvedBy: req.session.user.id
			},
			{ new: true }
		);

		res.json({ success: true, post, message: isApproved ? 'Post approved' : 'Post rejected' });
	} catch (err) {
		res.status(500).json({ success: false });
	}
});

// Admin deactivate post
router.put('/admin/posts/:id/deactivate', isLoggedIn, async (req, res) => {
	try {
		if (req.session.user.role !== 'admin') {
			return res.status(403).json({ success: false, message: 'Not authorized' });
		}

		const { reason } = req.body;
		const post = await ArtistPost.findByIdAndUpdate(
			req.params.id,
			{ isActive: false, rejectionReason: reason },
			{ new: true }
		);

		res.json({ success: true, post, message: 'Post deactivated' });
	} catch (err) {
		res.status(500).json({ success: false });
	}
});

// Admin delete post
router.delete('/admin/posts/:id', isLoggedIn, async (req, res) => {
	try {
		if (req.session.user.role !== 'admin') {
			return res.status(403).json({ success: false, message: 'Not authorized' });
		}

		const post = await ArtistPost.findById(req.params.id);
		if (!post) return res.status(404).json({ success: false });

		if (post.media && post.media.publicId) {
			await deleteMedia([post.media.publicId]);
		}

		await ArtistPost.findByIdAndDelete(req.params.id);
		res.json({ success: true, message: 'Post deleted by admin' });
	} catch (err) {
		res.status(500).json({ success: false });
	}
});

// View single post detail page
router.get('/posts/view/:id', async (req, res) => {
	try {
		const post = await ArtistPost.findById(req.params.id)
			.populate('artist', 'stageName profileImage genre')
			.populate('likes', 'name profileImage');

		if (!post) {
			return res.status(404).render('error/404', { message: 'Post not found' });
		}

		if (!post.isActive) {
			return res.status(404).render('error/404', { message: 'Post not available' });
		}

		// Extract YouTube ID if it's a YouTube link
		let youtubeId = null;
		if (post.media && post.media.url) {
			const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
			const match = post.media.url.match(youtubeRegex);
			if (match && match[1]) {
				youtubeId = match[1];
			}
		}

		res.render('posts/post-detail', {
			post: post.toObject(),
			artist: post.artist || {},
			user: req.session.user || null,
			youtubeId
		});
	} catch (err) {
		res.status(500).render('error/404', { message: 'Error loading post' });
	}
});

module.exports = router;
