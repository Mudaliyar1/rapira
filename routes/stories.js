const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const { isLoggedIn } = require('../middleware/auth');
const Artist = require('../models/Artist');
const ArtistStory = require('../models/ArtistStory');
const Follow = require('../models/Follow');
const Media = require('../models/Media');
const { uploadFileToCloudinary, deleteMedia } = require('../utils/mediaService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    const isAudio = file.mimetype.startsWith('audio/');

    if (isImage || isVideo || isAudio) {
      return cb(null, true);
    }
    cb(new Error('Only photo, video, and audio files are allowed for stories'));
  }
});

function storyExpiresAt() {
  const d = new Date();
  d.setHours(d.getHours() + 24);
  return d;
}

// Rate limit: max 20 stories / 24h per artist
async function canPostStory(artistId) {
  const since = new Date();
  since.setHours(since.getHours() - 24);
  const count = await ArtistStory.countDocuments({ artist: artistId, createdAt: { $gte: since } });
  return count < 20;
}

// Upload a new story (artist only)
router.post('/artists/stories', isLoggedIn, (req, res, next) => {
  upload.single('media')(req, res, (err) => {
    if (err) {
      req.flash('error', err.message);
      return res.redirect('/artists/dashboard');
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'artist') {
      req.flash('error', 'Only artists can post stories');
      return res.redirect('/artists/dashboard');
    }

    const artist = await Artist.findOne({ user: req.session.user.id });
    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/artists/dashboard');
    }

    if (!req.file) {
      req.flash('error', 'Please upload an image or short video');
      return res.redirect('/artists/dashboard');
    }

    const isImage = req.file.mimetype.startsWith('image/');
    const isVideo = req.file.mimetype.startsWith('video/');
    const isAudio = req.file.mimetype.startsWith('audio/');

    if (!isImage && !isVideo && !isAudio) {
      req.flash('error', 'Only photo, video, and audio files are allowed for stories');
      return res.redirect('/artists/dashboard');
    }

    // Rate limit
    const allowed = await canPostStory(artist._id);
    if (!allowed) {
      req.flash('error', 'Rate limit exceeded: max 20 stories in 24 hours');
      return res.redirect('/artists/dashboard');
    }

    const { media } = await uploadFileToCloudinary(req.file, {
      module: 'artistStory',
      ownerType: 'artist',
      ownerId: artist._id,
      folder: `rapira/artists/${artist._id}/stories`
    });

    const story = await ArtistStory.create({
      artist: artist._id,
      mediaUrl: media.secure_url,
      mediaPublicId: media.public_id,
      mediaType: isImage ? 'image' : (isVideo ? 'video' : 'audio'),
      caption: req.body.caption || '',
      durationMs: isImage ? 5000 : 10000,
      isActive: true,
      createdAt: new Date(),
      expiresAt: storyExpiresAt()
    });

    req.flash('success', 'Story posted');
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({ success: true, message: 'Story posted' });
    }
    res.redirect('/artists/dashboard');
  } catch (err) {
    console.error('Post story error:', err);
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({ success: false, error: 'Failed to post story' });
    }
    req.flash('error', 'Failed to post story');
    res.redirect('/artists/dashboard');
  }
});

// Fetch active stories feed (grouped by artist) - only from followed artists
router.get('/stories/feed', isLoggedIn, async (req, res) => {
  try {
    const now = new Date();

    // Get list of artist user IDs that the current user follows
    const followedArtists = await Follow.find({
      followerId: req.session.user.id,
      roleOfFollowing: 'artist'
    }).distinct('followingId');

    // Get all artists with those user IDs
    const artists = await Artist.find({ user: { $in: followedArtists } }).select('_id').lean();
    const artistIds = artists.map(a => a._id);

    // Only fetch stories from followed artists
    const stories = await ArtistStory.find({
      isActive: true,
      expiresAt: { $gt: now },
      artist: { $in: artistIds }
    })
      .populate({ path: 'artist', populate: { path: 'user' } })
      .sort({ createdAt: -1 })
      .lean();

    const byArtist = new Map();
    for (const s of stories) {
      const artistId = s.artist._id.toString();
      if (!byArtist.has(artistId)) {
        byArtist.set(artistId, {
          artist: {
            id: artistId,
            name: s.artist.user.name,
            profileImage: s.artist.user.profileImage
          },
          stories: []
        });
      }
      const seen = s.viewers?.some(v => v.toString() === req.session.user.id);
      const liked = s.likes?.some(l => l.toString() === req.session.user.id);
      byArtist.get(artistId).stories.push({
        _id: s._id,
        id: s._id,
        mediaUrl: s.mediaUrl,
        mediaType: s.mediaType,
        caption: s.caption,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        durationMs: s.durationMs,
        seen: !!seen,
        isLiked: !!liked,
        likesCount: s.likesCount || 0
      });
    }

    res.json({ success: true, data: Array.from(byArtist.values()) });
  } catch (err) {
    console.error('Stories feed error:', err);
    res.status(500).json({ success: false, message: 'Failed to load stories' });
  }
});

// Mark a story as viewed
router.post('/stories/:id/view', isLoggedIn, async (req, res) => {
  try {
    const story = await ArtistStory.findById(req.params.id);
    if (!story || !story.isActive) return res.status(404).json({ success: false, message: 'Story not found' });

    const userId = req.session.user.id;
    const already = story.viewers.some(v => v.toString() === userId);
    if (!already) {
      story.viewers.push(userId);
      story.viewsCount += 1;
      await story.save();
    }

    res.json({ success: true });
  } catch (err) {
    console.error('View story error:', err);
    res.status(500).json({ success: false });
  }
});

// Like/unlike a story
router.post('/stories/:id/like', isLoggedIn, async (req, res) => {
  try {
    const storyId = req.params.id;

    // Validate ID
    if (!storyId || storyId === 'undefined' || storyId === 'null') {
      console.error('[STORY LIKE ERROR] Invalid story ID received:', storyId);
      console.error('[STORY LIKE ERROR] Request URL:', req.originalUrl);
      console.error('[STORY LIKE ERROR] Referer:', req.get('Referer'));
      return res.status(400).json({
        success: false,
        message: 'Invalid story ID. Are you trying to like a post instead of a story?'
      });
    }

    const story = await ArtistStory.findById(storyId);
    if (!story || !story.isActive) return res.status(404).json({ success: false, message: 'Story not found' });

    const userId = req.session.user.id;
    const alreadyLiked = story.likes.some(l => l.toString() === userId);

    if (alreadyLiked) {
      // Unlike
      story.likes = story.likes.filter(l => l.toString() !== userId);
      story.likesCount = Math.max(0, story.likesCount - 1);
    } else {
      // Like
      story.likes.push(userId);
      story.likesCount += 1;
    }

    await story.save();
    res.json({ success: true, liked: !alreadyLiked, likesCount: story.likesCount });
  } catch (err) {
    console.error('Like story error:', err);
    res.status(500).json({ success: false, message: 'Failed to like story' });
  }
});

// Get likes list for a story (artist only)
router.get('/artists/stories/:id/likes', isLoggedIn, async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'artist') {
      return res.status(403).json({ success: false, message: 'Only artists can view story likes' });
    }

    const Artist = require('../models/Artist');
    const artist = await Artist.findOne({ user: req.session.user.id });
    if (!artist) {
      return res.status(404).json({ success: false, message: 'Artist profile not found' });
    }

    const story = await ArtistStory.findById(req.params.id)
      .populate({
        path: 'likes',
        select: 'name email profileImage role'
      });

    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    // Verify the story belongs to this artist
    if (story.artist.toString() !== artist._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only view likes of your own stories' });
    }

    res.json({
      success: true,
      likes: story.likes.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage || '/images/default-profile.svg',
        role: user.role
      })),
      likesCount: story.likesCount
    });
  } catch (err) {
    console.error('Get story likes error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch likes' });
  }
});

// Get viewers list for a story (artist only)
router.get('/artists/stories/:id/viewers', isLoggedIn, async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'artist') {
      return res.status(403).json({ success: false, message: 'Only artists can view story viewers' });
    }

    const artist = await Artist.findOne({ user: req.session.user.id });
    if (!artist) {
      return res.status(404).json({ success: false, message: 'Artist profile not found' });
    }

    const story = await ArtistStory.findById(req.params.id)
      .populate({
        path: 'viewers',
        select: 'name email profileImage role'
      });

    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    // Verify the story belongs to this artist
    if (story.artist.toString() !== artist._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only view viewers of your own stories' });
    }

    res.json({
      success: true,
      viewers: story.viewers.map(viewer => ({
        id: viewer._id,
        name: viewer.name,
        email: viewer.email,
        profileImage: viewer.profileImage || '/images/default-avatar.png',
        role: viewer.role
      })),
      viewsCount: story.viewsCount
    });
  } catch (err) {
    console.error('Get story viewers error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch viewers' });
  }
});

// Delete a story (artist only)
router.delete('/artists/stories/:id', isLoggedIn, async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'artist') {
      return res.status(403).json({ success: false, message: 'Only artists can delete stories' });
    }

    const artist = await Artist.findOne({ user: req.session.user.id });
    if (!artist) {
      return res.status(404).json({ success: false, message: 'Artist profile not found' });
    }

    const story = await ArtistStory.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    // Verify the story belongs to this artist
    if (story.artist.toString() !== artist._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own stories' });
    }

    // Delete the media from Cloudinary if it exists
    if (story.mediaPublicId) {
      try {
        await deleteMedia([story.mediaPublicId]);
      } catch (err) {
        console.error('Failed to delete story media from Cloudinary:', err);
        // Continue with deletion even if Cloudinary deletion fails
      }
    }

    // Delete the story from database
    await ArtistStory.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Story deleted successfully' });
  } catch (err) {
    console.error('Delete story error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete story' });
  }
});

// Get story details (artist only)
router.get('/artists/stories/:id/details', isLoggedIn, async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'artist') {
      return res.status(403).json({ success: false, message: 'Only artists can view story details' });
    }

    const artist = await Artist.findOne({ user: req.session.user.id });
    if (!artist) return res.status(404).json({ success: false, message: 'Artist profile not found' });

    const story = await ArtistStory.findById(req.params.id);
    if (!story) return res.status(404).json({ success: false, message: 'Story not found' });

    if (story.artist.toString() !== artist._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only view details of your own stories' });
    }

    res.json({ success: true, story });
  } catch (err) {
    console.error('Get story details error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch details' });
  }
});

// Update story caption (artist only)
router.put('/artists/stories/:id', isLoggedIn, async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'artist') {
      return res.status(403).json({ success: false, message: 'Only artists can update stories' });
    }

    const artist = await Artist.findOne({ user: req.session.user.id });
    if (!artist) return res.status(404).json({ success: false, message: 'Artist profile not found' });

    const story = await ArtistStory.findById(req.params.id);
    if (!story) return res.status(404).json({ success: false, message: 'Story not found' });

    if (story.artist.toString() !== artist._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own stories' });
    }

    story.caption = req.body.caption || '';
    await story.save();

    res.json({ success: true, message: 'Story updated successfully' });
  } catch (err) {
    console.error('Update story error:', err);
    res.status(500).json({ success: false, message: 'Failed to update story' });
  }
});

module.exports = router;
