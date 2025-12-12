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
    const allowed = /jpeg|jpg|png|gif|mp4|webm|ogg|mov|avi/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /image|video/.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only image/video files allowed'));
  }
});

// === ARTIST ROUTES ===

// Create post
router.post('/posts', isLoggedIn, upload.single('media'), async (req, res) => {
  try {
    console.log('POST /posts - User role:', req.session.user.role);
    
    if (req.session.user.role !== 'artist') {
      console.log('Not an artist, role:', req.session.user.role);
      return res.status(403).json({ success: false, message: 'Only artists can create posts' });
    }

    const artist = await Artist.findOne({ user: req.session.user.id });
    console.log('Artist found:', !!artist);
    if (!artist) {
      return res.status(404).json({ success: false, message: 'Artist profile not found' });
    }

    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ success: false, message: 'Please upload an image or video' });
    }

    console.log('File received:', { originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size });

    const isImage = req.file.mimetype.startsWith('image/');
    const isVideo = req.file.mimetype.startsWith('video/');
    if (!isImage && !isVideo) {
      return res.status(400).json({ success: false, message: 'Only image/video files allowed' });
    }

    // Upload to Cloudinary
    const folder = isImage ? 'rapira/artist-posts/images' : 'rapira/artist-posts/videos';
    console.log('Uploading to Cloudinary folder:', folder);
    
    const uploadRes = await uploadFileToCloudinary(req.file, { folder });
    console.log('Cloudinary upload response:', { 
      hasMedia: !!uploadRes.media, 
      hasResult: !!uploadRes.result,
      url: uploadRes.media?.secure_url || uploadRes.result?.secure_url
    });
    
    if (!uploadRes.media || !uploadRes.result) {
      console.error('Cloudinary upload failed - missing response data:', uploadRes);
      return res.status(500).json({ success: false, message: 'Upload to Cloudinary failed' });
    }

    // Extract hashtags
    const caption = req.body.caption || '';
    const hashtags = caption.match(/#\w+/g) || [];

    const post = new ArtistPost({
      artist: artist._id,
      media: {
        url: uploadRes.media.secure_url || uploadRes.result.secure_url,
        mediaType: isImage ? 'image' : 'video',
        publicId: uploadRes.media.public_id || uploadRes.result.public_id
      },
      caption,
      hashtags: hashtags.map(tag => tag.substring(1).toLowerCase())
    });

    console.log('Creating post with media:', post.media);
    await post.save();
    console.log('Post saved:', post._id);
    res.json({ success: true, post, message: 'Post created! Awaiting admin approval.' });
  } catch (err) {
    console.error('Post creation error:', err);
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
      return res.status(404).json({ success: false });
    }

    const posts = await ArtistPost.find({ artist: artist._id })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, posts });
  } catch (err) {
    console.error('Fetch my posts error:', err);
    res.status(500).json({ success: false });
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

    // Properly format posts for JSON response
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
        createdAt: postObj.createdAt,
        isApproved: postObj.isApproved,
        isActive: postObj.isActive
      };
    });

    res.json({ success: true, posts: formattedPosts });
  } catch (err) {
    console.error('Fetch posts error:', err);
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

    res.json({ success: true, post, message: 'Post updated' });
  } catch (err) {
    console.error('Update post error:', err);
    res.status(500).json({ success: false });
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

    // Delete from Cloudinary
    if (post.media && post.media.publicId) {
      await deleteMedia([post.media.publicId]);
    }

    await ArtistPost.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ success: false });
  }
});

// Like post
router.post('/posts/:id/like', isLoggedIn, async (req, res) => {
  try {
    const post = await ArtistPost.findById(req.params.id);
    if (!post || !post.isActive) return res.status(404).json({ success: false });

    const userId = req.session.user.id;
    const alreadyLiked = post.likes.some(l => l.toString() === userId);

    if (alreadyLiked) {
      post.likes = post.likes.filter(l => l.toString() !== userId);
      post.likesCount = Math.max(0, post.likesCount - 1);
    } else {
      post.likes.push(userId);
      post.likesCount += 1;
    }

    await post.save();
    res.json({ success: true, liked: !alreadyLiked, likesCount: post.likesCount });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ success: false });
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
    console.error('Get likes error:', err);
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

    // Normalize media shape for older records
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

      return post;
    });

    res.json({ success: true, posts: normalizedPosts });
  } catch (err) {
    console.error('Admin get posts error:', err);
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
    console.error('Admin approve error:', err);
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
    console.error('Admin deactivate error:', err);
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

    // Delete from Cloudinary
    if (post.media && post.media.publicId) {
      await deleteMedia([post.media.publicId]);
    }

    await ArtistPost.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Post deleted by admin' });
  } catch (err) {
    console.error('Admin delete error:', err);
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

    // Only show approved posts
    if (!post.isApproved || !post.isActive) {
      return res.status(404).render('error/404', { message: 'Post not available' });
    }

    res.render('posts/post-detail', {
      post: post.toObject(),
      artist: post.artist || {},
      user: req.session.user || null
    });
  } catch (err) {
    console.error('Post detail error:', err);
    res.status(500).render('error/404', { message: 'Error loading post' });
  }
});

module.exports = router;
