const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { isLoggedIn } = require('../middleware/auth');
const Artist = require('../models/Artist');
const ArtistPost = require('../models/ArtistPost');
const { uploadFileToCloudinary, deleteMedia } = require('../utils/mediaService');

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
	fileFilter: (req, file, cb) => {
		const allowed = /jpeg|jpg|png|gif|mp4|webm|ogg|mov|avi|mp3|wav|m4a|aac|flac/;
		const extname = allowed.test(path.extname(file.originalname).toLowerCase());
		const mimetype = /image|video|audio/.test(file.mimetype);
		if (extname && mimetype) return cb(null, true);
		cb(new Error('Only image/video/audio files allowed'));
	}
});

// === ARTIST ROUTES ===

// Create post
router.post('/posts', isLoggedIn, upload.single('media'), async (req, res) => {
	try {
		console.log('[POST /posts] Starting upload...');
		console.log('[POST /posts] User role:', req.session.user.role);
		console.log('[POST /posts] File:', req.file ? { name: req.file.originalname, type: req.file.mimetype, size: req.file.size } : 'NO FILE');
		
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
		console.log('[POST /posts] Cloudinary upload result:', uploadRes.media ? 'SUCCESS' : 'FAILED');
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
			hashtags: hashtags.map(tag => tag.substring(1).toLowerCase())
		});

		console.log('[POST /posts] About to save post:', JSON.stringify(post, null, 2));
		await post.save();
		console.log('[POST /posts] Post saved to DB:', post._id);
		console.log('[POST /posts] Response being sent:', { success: true, message: 'Post created! Awaiting admin approval.' });
		res.json({ success: true, post, message: 'Post created! Awaiting admin approval.' });
	} catch (err) {
		console.error('[POST /posts] ERROR:', err.message);
		console.error('[POST /posts] Stack:', err.stack);
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
				shares: postObj.shares || 0,
				views: postObj.views || 0,
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
			isActive: true,
			isApproved: true
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
				shares: postObj.shares || 0,
				views: postObj.views || 0, // Add views to response
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

		const userId = req.session.user.id;
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
		res.json({ success: true, liked: !alreadyLiked, likesCount: post.likesCount });
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
		res.json({ success: true, views: post.views });
	} catch (err) {
		res.status(500).json({ success: false });
	}
});

// JSON endpoint for single post (for modal rendering)
router.get('/posts/:id/json', async (req, res) => {
	try {
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

		if (!post || !post.isApproved || !post.isActive) {
			return res.status(404).json({ success: false, message: 'Post not available' });
		}

		// Increment view count
		post.views = (post.views || 0) + 1;
		await post.save();

		const userId = req.session?.user?.id;
		const liked = userId ? post.likes.some(l => l._id?.toString() === userId) : false;

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
			shares: post.shares || 0,
			views: post.views || 0, // Include views in response
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

		if (!post.isApproved || !post.isActive) {
			return res.status(404).render('error/404', { message: 'Post not available' });
		}

		res.render('posts/post-detail', {
			post: post.toObject(),
			artist: post.artist || {},
			user: req.session.user || null
		});
	} catch (err) {
		res.status(500).render('error/404', { message: 'Error loading post' });
	}
});

module.exports = router;
