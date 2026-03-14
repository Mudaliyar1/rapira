const express = require('express');
const router = express.Router();
const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/User');
const Artist = require('../models/Artist');
const Content = require('../models/Content');
const Concert = require('../models/Concert');
const Follow = require('../models/Follow');
const Media = require('../models/Media');
const ArtistUnblockRequest = require('../models/ArtistUnblockRequest');
const ProducerBeat = require('../models/ProducerBeat');
const BeatPurchase = require('../models/BeatPurchase');
const WebsiteSettings = require('../models/WebsiteSettings');
const UserRole = require('../models/UserRole');
const Role = require('../models/Role');
const { isLoggedIn, isArtist } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { uploadFileToCloudinary, deleteMedia } = require('../utils/mediaService');
const { getFileUrl } = require('../utils/fileHelper');

// Configure multer for artist uploads (memory → Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Configure multer for content uploads (memory → Cloudinary)
const contentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'contentFile') {
      const filetypes = /mp3|wav|mp4|mov|pdf|doc|docx/;
      const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
      if (extname) {
        return cb(null, true);
      } else {
        cb(new Error('Only audio, video, and document files are allowed'));
      }
    } else {
      const filetypes = /jpeg|jpg|png|gif/;
      const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = filetypes.test(file.mimetype);
      if (extname && mimetype) {
        return cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  }
});

// List all artists
router.get('/', async (req, res) => {
  try {
    // Get filter parameters
    const { search, genre, verified, sort } = req.query;

    // Build filter object
    const filter = {};

    // Get only artists with valid user references first
    let artists = await Artist.find(filter)
      .populate('user', 'name profileImage')
      .then(artists => artists.filter(artist => artist.user));

    // Apply search filter
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      artists = artists.filter(artist =>
        searchRegex.test(artist.user.name) ||
        searchRegex.test(artist.stageName || '') ||
        searchRegex.test(artist.genre || '') ||
        searchRegex.test(artist.bio || '')
      );
    }

    // Apply genre filter
    if (genre && genre !== '') {
      artists = artists.filter(artist =>
        artist.genre && artist.genre.toLowerCase().includes(genre.toLowerCase())
      );
    }

    // Apply verified filter
    if (verified && verified !== 'all') {
      const isVerified = verified === 'true';
      artists = artists.filter(artist => artist.verified === isVerified);
    }

    // Apply sorting
    if (sort) {
      switch (sort) {
        case 'name':
          artists.sort((a, b) => a.user.name.localeCompare(b.user.name));
          break;
        case 'genre':
          artists.sort((a, b) => (a.genre || '').localeCompare(b.genre || ''));
          break;
        case 'verified':
          artists.sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0));
          break;
        case 'newest':
          artists.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          break;
        case 'oldest':
        default:
          artists.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          break;
      }
    }

    // Get unique genres for filter
    const allArtists = await Artist.find()
      .populate('user', 'name')
      .then(artists => artists.filter(artist => artist.user));

    const genres = [...new Set(allArtists
      .map(artist => artist.genre)
      .filter(genre => genre && genre.trim())
    )].sort();

    // Calculate statistics
    const totalArtists = allArtists.length;
    const verifiedArtists = allArtists.filter(artist => artist.verified).length;
    const unverifiedArtists = totalArtists - verifiedArtists;

    const stats = {
      total: totalArtists,
      verified: verifiedArtists,
      unverified: unverifiedArtists,
      filtered: artists.length
    };

    res.render('artists/index', {
      artists,
      genres,
      filters: { search, genre, verified: verified || 'all', sort: sort || 'oldest' },
      stats,
      user: req.session.user || null
    });
  } catch (error) {
    console.error('Artists list error:', error);
    req.flash('error', 'Failed to load artists');
    res.redirect('/');
  }
});

// Artist dashboard
router.get('/dashboard', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id })
      .populate('user');

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    // Check if artist is blocked
    if (artist.isBlocked) {
      return res.render('artists/blocked', {
        layout: false,
        title: 'Account Blocked',
        artist,
        blockReason: artist.blockReason || 'Your account has been blocked by the administration.'
      });
    }

    // Get artist's concerts
    const concerts = await Concert.find({ artist: artist._id })
      .populate('venue')
      .sort({ date: -1 });

    // Get artist's content
    const content = await Content.find({ artist: artist._id })
      .sort({ createdAt: -1 });

    // Get artist's followers
    const followers = await Follow.find({ followingId: req.session.user.id })
      .populate('followerId', 'name email profileImage role')
      .sort({ createdAt: -1 });

    // Get follower counts
    const followerCounts = {
      totalFollowers: await Follow.countDocuments({ followingId: req.session.user.id }),
      userFollowers: await Follow.countDocuments({ followingId: req.session.user.id, roleOfFollower: 'user' }),
      artistFollowers: await Follow.countDocuments({ followingId: req.session.user.id, roleOfFollower: 'artist' })
    };

    // Get artist's stories
    const ArtistStory = require('../models/ArtistStory');
    const now = new Date();
    const stories = await ArtistStory.find({
      artist: artist._id,
      expiresAt: { $gt: now }
    }).sort({ createdAt: -1 });

    // Check if the request is from the profile page (AJAX)
    console.log('Artist dashboard request received from user:', req.session.user.id);
    console.log('Headers:', req.headers);
    console.log('Concerts found in database:', concerts.length);

    // More reliable check for JSON request
    const wantsJson =
      req.xhr ||
      (req.headers.accept && req.headers.accept.indexOf('application/json') > -1) ||
      (req.query.format === 'json');

    if (wantsJson) {
      // Format concerts for JSON response
      const upcomingConcerts = concerts
        .filter(c => new Date(c.date) >= new Date() && c.status === 'approved')
        .map(concert => ({
          id: concert._id,
          title: concert.title,
          date: concert.date,
          venue: concert.venue,
          status: 'approved'
        }));

      const pendingConcerts = concerts
        .filter(c => c.status === 'pending')
        .map(concert => ({
          id: concert._id,
          title: concert.title,
          date: concert.date,
          venue: concert.venue,
          status: 'pending'
        }));

      // Add debug log
      console.log('Returning JSON concerts data:', upcomingConcerts.length + pendingConcerts.length, 'concerts found');

      // Set proper content type header
      res.setHeader('Content-Type', 'application/json');
      return res.json({
        concerts: [...upcomingConcerts, ...pendingConcerts]
      });
    }

    // Regular page request
    res.render('artists/dashboard-new', {
      layout: false,
      currentPath: '/artists/dashboard',
      title: 'Artist Dashboard',
      artist,
      concerts,
      content,
      followers,
      followerCounts,
      stories,
      upcomingConcerts: concerts.filter(c => new Date(c.date) >= new Date() && c.status === 'approved'),
      pendingConcerts: concerts.filter(c => c.status === 'pending'),
      pastConcerts: concerts.filter(c => new Date(c.date) < new Date() && c.status === 'approved')
    });
  } catch (error) {
    console.error('Artist dashboard error:', error);
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(500).json({ error: 'Failed to load concerts' });
    }
    req.flash('error', 'Failed to load dashboard');
    res.redirect('/');
  }
});

// Upload content page
router.get('/upload-content', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id })
      .populate('user');

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    res.render('artists/upload-content-new', {
      layout: false,
      currentPath: '/artists/upload-content',
      title: 'Upload Content',
      artist
    });
  } catch (error) {
    console.error('Upload content page error:', error);
    req.flash('error', 'Failed to load upload page');
    res.redirect('/artists/dashboard');
  }
});

router.get('/messages', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id }).populate('user');

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    res.render('artists/messages', {
      layout: false,
      currentPath: '/artists/messages',
      title: 'Producer Messages',
      artist
    });
  } catch (error) {
    console.error('Artist messages page error:', error);
    req.flash('error', 'Failed to load messages page');
    res.redirect('/artists/dashboard');
  }
});

// Upload content process
router.post('/upload-content', isLoggedIn, isArtist,
  contentUpload.fields([
    { name: 'thumbnailImage', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { title, type, description, youtubeLink } = req.body;

      // Validate input
      if (!title || !type) {
        req.flash('error', 'Please provide title and content type');
        return res.redirect('/artists/upload-content');
      }

      if (!youtubeLink) {
        req.flash('error', 'Please provide a YouTube link');
        return res.redirect('/artists/upload-content');
      }

      // Validate YouTube link
      let youtubeId = '';
      try {
        // Clean up the YouTube link (trim whitespace, etc.)
        const cleanYoutubeLink = youtubeLink.trim();

        // Extract YouTube video ID from various YouTube URL formats
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = cleanYoutubeLink.match(youtubeRegex);

        if (!match || !match[1]) {
          req.flash('error', 'Invalid YouTube link. Please provide a valid YouTube URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID)');
          return res.redirect('/artists/upload-content');
        }

        youtubeId = match[1];

        // Verify the YouTube ID is valid by checking if it's 11 characters
        if (youtubeId.length !== 11) {
          req.flash('error', 'Invalid YouTube video ID. Please check your link and try again.');
          return res.redirect('/artists/upload-content');
        }

        console.log(`Extracted YouTube ID: ${youtubeId} from link: ${cleanYoutubeLink}`);
      } catch (err) {
        console.error('Error parsing YouTube link:', err);
        req.flash('error', 'Invalid YouTube link format');
        return res.redirect('/artists/upload-content');
      }

      const artist = await Artist.findOne({ user: req.session.user.id });

      if (!artist) {
        req.flash('error', 'Artist profile not found');
        return res.redirect('/');
      }

      // Create content
      const newContent = new Content({
        artist: artist._id,
        title,
        type,
        description: description || '',
        fileUrl: youtubeLink,
        isYoutubeLink: true,
        youtubeId
      });

      // Upload thumbnail to Cloudinary if provided
      let thumbnailMedia = null;
      if (req.files && req.files.thumbnailImage) {
        try {
          const thumbnailFile = req.files.thumbnailImage[0];
          const { media } = await uploadFileToCloudinary(thumbnailFile, {
            module: 'artistContent',
            ownerType: 'artist',
            ownerId: artist._id,
            folder: 'rapira/artist-content/thumbnails'
          });
          thumbnailMedia = media;
          newContent.thumbnailUrl = media.secure_url;
          newContent.thumbnailMedia = media._id;
        } catch (err) {
          console.error('Thumbnail upload error:', err);
          req.flash('warning', 'Content uploaded, but thumbnail upload failed. Using YouTube thumbnail instead.');
          newContent.thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
        }
      } else {
        // Use YouTube thumbnail if no custom thumbnail is provided
        newContent.thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
      }

      await newContent.save();

      req.flash('success', 'Content uploaded successfully');
      res.redirect('/artists/dashboard');
    } catch (error) {
      console.error('Upload content error:', error);
      req.flash('error', 'Failed to upload content');
      res.redirect('/artists/upload-content');
    }
  });

// Edit content page
router.get('/content/:id/edit', isLoggedIn, isArtist, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);

    if (!content) {
      req.flash('error', 'Content not found');
      return res.redirect('/artists/dashboard');
    }

    const artist = await Artist.findOne({ user: req.session.user.id }).populate('user');

    // Check if the artist owns this content
    if (content.artist.toString() !== artist._id.toString()) {
      req.flash('error', 'You do not have permission to edit this content');
      return res.redirect('/artists/dashboard');
    }

    res.render('artists/edit-content', {
      layout: false,
      currentPath: '/artists/content/edit',
      title: 'Edit Content',
      artist,
      content
    });
  } catch (error) {
    console.error('Edit content page error:', error);
    req.flash('error', 'Failed to load edit page');
    res.redirect('/artists/dashboard');
  }
});

// Update content
router.post('/content/:id/update', isLoggedIn, isArtist,
  contentUpload.fields([
    { name: 'thumbnailImage', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { title, description, youtubeLink } = req.body;

      // Validate input
      if (!title) {
        req.flash('error', 'Please provide a title');
        return res.redirect(`/artists/content/${req.params.id}/edit`);
      }

      const content = await Content.findById(req.params.id).populate('thumbnailMedia');

      if (!content) {
        req.flash('error', 'Content not found');
        return res.redirect('/artists/dashboard');
      }

      const artist = await Artist.findOne({ user: req.session.user.id });

      // Check if the artist owns this content
      if (content.artist.toString() !== artist._id.toString()) {
        req.flash('error', 'You do not have permission to edit this content');
        return res.redirect('/artists/dashboard');
      }

      // Update content fields
      content.title = title;
      content.description = description || '';

      // Update YouTube link if provided
      if (youtubeLink) {
        try {
          // Clean up the YouTube link (trim whitespace, etc.)
          const cleanYoutubeLink = youtubeLink.trim();

          // Validate YouTube link
          const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
          const match = cleanYoutubeLink.match(youtubeRegex);

          if (!match || !match[1]) {
            req.flash('error', 'Invalid YouTube link. Please provide a valid YouTube URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID)');
            return res.redirect(`/artists/content/${req.params.id}/edit`);
          }

          const youtubeId = match[1];

          // Verify the YouTube ID is valid by checking if it's 11 characters
          if (youtubeId.length !== 11) {
            req.flash('error', 'Invalid YouTube video ID. Please check your link and try again.');
            return res.redirect(`/artists/content/${req.params.id}/edit`);
          }

          console.log(`Updating content with YouTube ID: ${youtubeId} from link: ${cleanYoutubeLink}`);

          // Update content with new YouTube info
          content.fileUrl = cleanYoutubeLink;
          content.isYoutubeLink = true;
          content.youtubeId = youtubeId;

          // If no custom thumbnail is uploaded, use YouTube thumbnail
          if (!req.files || !req.files.thumbnailImage) {
            content.thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
          }
        } catch (err) {
          console.error('Error parsing YouTube link:', err);
          req.flash('error', 'Invalid YouTube link format');
          return res.redirect(`/artists/content/${req.params.id}/edit`);
        }
      }

      // Update thumbnail if uploaded to Cloudinary
      if (req.files && req.files.thumbnailImage) {
        try {
          const thumbnailFile = req.files.thumbnailImage[0];

          // Delete old thumbnail from Cloudinary if it exists
          if (content.thumbnailMedia) {
            await deleteMedia(content.thumbnailMedia);
          }

          // Upload new thumbnail
          const { media } = await uploadFileToCloudinary(thumbnailFile, {
            module: 'artistContent',
            ownerType: 'artist',
            ownerId: artist._id,
            folder: 'rapira/artist-content/thumbnails'
          });

          content.thumbnailUrl = media.secure_url;
          content.thumbnailMedia = media._id;
        } catch (err) {
          console.error('Thumbnail upload error:', err);
          req.flash('warning', 'Content updated, but thumbnail upload failed.');
        }
      }

      await content.save();

      req.flash('success', 'Content updated successfully');
      res.redirect('/artists/dashboard');
    } catch (error) {
      console.error('Update content error:', error);
      req.flash('error', 'Failed to update content');
      res.redirect(`/artists/content/${req.params.id}/edit`);
    }
  });

// Content management page
router.get('/manage-content', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id })
      .populate('user');

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    // Get search parameters
    const { search, type, featured, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = { artist: artist._id };

    // Search filter
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Type filter
    if (type && type !== 'all') {
      filter.type = type;
    }

    // Featured filter
    if (featured && featured !== 'all') {
      filter.featured = featured === 'true';
    }

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        filter.createdAt = { $gte: startOfDay, $lt: endOfDay };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        filter.createdAt = { $gte: startOfWeek };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filter.createdAt = { $gte: startOfMonth };
      } else if (dateRange === 'this-year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        filter.createdAt = { $gte: startOfYear };
      }
    }

    // Build sort options
    let sortOptions = { createdAt: -1 };
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get artist's content with filters
    const content = await Content.find(filter)
      .sort(sortOptions);

    // Get stats for the artist's content
    const totalContent = await Content.countDocuments({ artist: artist._id });
    const musicContent = await Content.countDocuments({ artist: artist._id, type: 'song' });
    const videoContent = await Content.countDocuments({ artist: artist._id, type: 'video' });
    const lyricsContent = await Content.countDocuments({ artist: artist._id, type: 'lyrics' });
    const featuredContent = await Content.countDocuments({ artist: artist._id, featured: true });

    res.render('artists/manage-content', {
      layout: false,
      currentPath: '/artists/manage-content',
      title: 'Manage Content',
      artist,
      content,
      searchParams: {
        search: search || '',
        type: type || 'all',
        featured: featured || 'all',
        dateRange: dateRange || 'all',
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc'
      },
      stats: {
        total: totalContent,
        music: musicContent,
        video: videoContent,
        lyrics: lyricsContent,
        featured: featuredContent,
        filtered: content.length
      }
    });
  } catch (error) {
    console.error('Manage content page error:', error);
    req.flash('error', 'Failed to load content management page');
    res.redirect('/artists/dashboard');
  }
});

// Manage Posts page
router.get('/manage-posts', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id })
      .populate('user');

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    res.render('artists/manage-posts-new', {
      layout: false,
      currentPath: '/artists/manage-posts',
      title: 'Manage Posts',
      artist
    });
  } catch (error) {
    console.error('Manage posts page error:', error);
    req.flash('error', 'Failed to load posts page');
    res.redirect('/artists/dashboard');
  }
});

// Dedicated edit post page (artist-owned)
router.get('/posts/:id/edit', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id });
    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    const ArtistPost = require('../models/ArtistPost');
    const post = await ArtistPost.findById(req.params.id);
    if (!post || post.artist.toString() !== artist._id.toString()) {
      req.flash('error', 'Post not found');
      return res.redirect('/artists/manage-posts');
    }

    res.render('artists/edit-post', {
      layout: false,
      title: 'Edit Post',
      currentPath: '/artists/manage-posts',
      artist,
      post
    });
  } catch (error) {
    console.error('Edit post page error:', error);
    req.flash('error', 'Failed to load edit page');
    res.redirect('/artists/manage-posts');
  }
});

// Dedicated delete confirmation page (artist-owned)
router.get('/posts/:id/delete', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id });
    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    const ArtistPost = require('../models/ArtistPost');
    const post = await ArtistPost.findById(req.params.id);
    if (!post || post.artist.toString() !== artist._id.toString()) {
      req.flash('error', 'Post not found');
      return res.redirect('/artists/manage-posts');
    }

    res.render('artists/delete-post', {
      layout: false,
      title: 'Delete Post',
      currentPath: '/artists/manage-posts',
      artist,
      post
    });
  } catch (error) {
    console.error('Delete post page error:', error);
    req.flash('error', 'Failed to load delete page');
    res.redirect('/artists/manage-posts');
  }
});

// Concert management page
router.get('/manage-concerts', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id })
      .populate('user');

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    // Get search parameters
    const { search, status, type, city, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = { artist: artist._id };

    // Search filter
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { venue: new RegExp(search, 'i') },
        { city: new RegExp(search, 'i') }
      ];
    }

    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Type filter (paid/free)
    if (type && type !== 'all') {
      filter.isPaid = type === 'paid';
    }

    // City filter
    if (city && city !== 'all') {
      filter.city = new RegExp(city, 'i');
    }

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'upcoming') {
        filter.date = { $gte: now };
      } else if (dateRange === 'past') {
        filter.date = { $lt: now };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.date = { $gte: startOfMonth, $lte: endOfMonth };
      } else if (dateRange === 'this-year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        filter.date = { $gte: startOfYear, $lte: endOfYear };
      }
    }

    // Build sort options
    let sortOptions = { date: -1 };
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get artist's concerts with filters
    const concerts = await Concert.find(filter)
      .populate('venue')
      .sort(sortOptions);

    // Get stats for the artist's concerts
    const totalConcerts = await Concert.countDocuments({ artist: artist._id });
    const upcomingConcerts = concerts.filter(c => new Date(c.date) >= new Date() && c.status === 'approved');
    const pendingConcerts = concerts.filter(c => c.status === 'pending');
    const rejectedConcerts = concerts.filter(c => c.status === 'rejected');
    const pastConcerts = concerts.filter(c => new Date(c.date) < new Date() && c.status === 'approved');
    const paidConcerts = await Concert.countDocuments({ artist: artist._id, isPaid: true });
    const freeConcerts = await Concert.countDocuments({ artist: artist._id, isPaid: false });

    // Get unique cities for filter dropdown
    const allConcerts = await Concert.find({ artist: artist._id }).populate('venue');
    const cities = [...new Set(allConcerts.map(c => c.city))].sort();

    res.render('artists/manage-concerts', {
      layout: false,
      currentPath: '/artists/manage-concerts',
      title: 'Manage Concerts',
      artist,
      concerts,
      upcomingConcerts,
      pendingConcerts,
      rejectedConcerts,
      pastConcerts,
      cities,
      searchParams: {
        search: search || '',
        status: status || 'all',
        type: type || 'all',
        city: city || 'all',
        dateRange: dateRange || 'all',
        sortBy: sortBy || 'date',
        sortOrder: sortOrder || 'desc'
      },
      stats: {
        total: totalConcerts,
        upcoming: upcomingConcerts.length,
        pending: pendingConcerts.length,
        rejected: rejectedConcerts.length,
        past: pastConcerts.length,
        paid: paidConcerts,
        free: freeConcerts,
        filtered: concerts.length
      }
    });
  } catch (error) {
    console.error('Manage concerts page error:', error);
    req.flash('error', 'Failed to load concert management page');
    res.redirect('/artists/dashboard');
  }
});

// Concert details page for artist
router.get('/concerts/:id/details', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id });

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    // Get concert details with venue and ticket information
    const concert = await Concert.findOne({
      _id: req.params.id,
      artist: artist._id
    }).populate('venue');

    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/artists/manage-concerts');
    }

    // Get tickets sold for this concert
    const Ticket = require('../models/Ticket');
    const tickets = await Ticket.find({ concert: concert._id });

    // Calculate financial details
    let venueFinancials = null;
    if (concert.venueBooking && concert.venueBooking.totalVenueCost) {
      const totalCost = concert.venueBooking.totalVenueCost || 0;
      const commissionPercentage = concert.venueBooking.adminCommission?.percentage || 0;
      const storedCommission = concert.venueBooking.adminCommission?.advanceAmount;

      // Get commission amount (from stored advance or calculate from percentage)
      const commissionAmount = Number.isFinite(storedCommission) && storedCommission > 0
        ? storedCommission
        : (concert.venueBooking?.isPaid && commissionPercentage > 0
          ? (totalCost * commissionPercentage) / 100
          : 0);

      // Get amount paid by artist (direct payment to venue)
      const artistPaidDirect = concert.venueBooking.amountPaidByArtist || 0;

      // Total paid = commission already collected + direct payment
      const totalPaid = commissionAmount + artistPaidDirect;

      // Total expected payment = venue cost + commission
      const totalExpectedPayment = totalCost + commissionAmount;

      // Remaining balance = total expected payment - total paid
      const remainingBalance = Math.max(totalExpectedPayment - totalPaid, 0);

      venueFinancials = {
        totalCost,
        commissionPercentage,
        commissionAmount,
        artistPaidDirect,
        totalPaid,
        totalExpectedPayment,
        remainingBalance,
        capacity: concert.venue.capacity || 0,
        allocatedSeats: concert.maxTickets || 0,
        duration: concert.venueBooking.bookingHours || 0
      };
    }

    // Calculate revenue breakdown
    let totalPlatformFees = 0;
    let artistNetIncome = 0;
    let totalSalesValue = 0;

    tickets.forEach(ticket => {
      if (ticket.paymentStatus === 'completed') {
        const commission = ticket.commissionAmount || 0;
        const total = ticket.totalAmount || 0;

        totalPlatformFees += commission;
        artistNetIncome += (total - commission);
        totalSalesValue += total;
      }
    });

    // Use totalSalesValue as the overall ticketRevenue
    const ticketRevenue = totalSalesValue;

    res.render('artists/concert-details', {
      layout: false,
      currentPath: '/artists/manage-concerts',
      title: 'Concert Details',
      artist,
      concert,
      venueFinancials,
      ticketRevenue,
      totalPlatformFees,
      artistNetIncome,
      tickets
    });
  } catch (error) {
    console.error('Concert details page error:', error);
    req.flash('error', 'Failed to load concert details');
    res.redirect('/artists/manage-concerts');
  }
});

// Ticket management page
router.get('/manage-tickets', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id })
      .populate('user');

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    // Get search parameters
    const { search, concert, dateRange, sortBy, sortOrder } = req.query;

    // Get artist's concerts
    const concerts = await Concert.find({ artist: artist._id }).populate('venue');

    // Build filter object for tickets
    const Ticket = require('../models/Ticket');
    const filter = {
      concert: { $in: concerts.map(c => c._id) },
      paymentStatus: 'completed'
    };

    // Concert filter
    if (concert && concert !== 'all') {
      filter.concert = concert;
    }

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        filter.purchaseDate = { $gte: startOfDay, $lt: endOfDay };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        filter.purchaseDate = { $gte: startOfWeek };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filter.purchaseDate = { $gte: startOfMonth };
      } else if (dateRange === 'this-year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        filter.purchaseDate = { $gte: startOfYear };
      }
    }

    // Build sort options
    let sortOptions = { purchaseDate: -1 };
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get all tickets for the artist's concerts with filters
    let tickets = await Ticket.find(filter)
      .populate('concert')
      .populate('user', 'name email')
      .sort(sortOptions);

    // Apply search filter after population (for user name and concert title)
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      tickets = tickets.filter(ticket =>
        (ticket.user && searchRegex.test(ticket.user.name)) ||
        (ticket.user && searchRegex.test(ticket.user.email)) ||
        (ticket.concert && searchRegex.test(ticket.concert.title)) ||
        searchRegex.test(ticket.ticketNumber)
      );
    }

    // Get stats for the artist's tickets
    const totalTickets = await Ticket.countDocuments({
      concert: { $in: concerts.map(c => c._id) },
      paymentStatus: 'completed'
    });

    const totalRevenue = await Ticket.aggregate([
      { $match: { concert: { $in: concerts.map(c => c._id) }, paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const totalQuantity = await Ticket.aggregate([
      { $match: { concert: { $in: concerts.map(c => c._id) }, paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$quantity' } } }
    ]);

    res.render('artists/manage-tickets', {
      layout: false,
      currentPath: '/artists/manage-tickets',
      title: 'Manage Tickets',
      artist,
      tickets,
      concerts,
      searchParams: {
        search: search || '',
        concert: concert || 'all',
        dateRange: dateRange || 'all',
        sortBy: sortBy || 'purchaseDate',
        sortOrder: sortOrder || 'desc'
      },
      stats: {
        total: totalTickets,
        revenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
        quantity: totalQuantity.length > 0 ? totalQuantity[0].total : 0,
        filtered: tickets.length
      }
    });
  } catch (error) {
    console.error('Manage tickets page error:', error);
    req.flash('error', 'Failed to load ticket management page');
    res.redirect('/artists/dashboard');
  }
});

// View ticket details page
router.get('/tickets/:id/view', isLoggedIn, isArtist, async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
    const ticket = await Ticket.findById(req.params.id)
      .populate('concert')
      .populate('user', 'name email phone');

    if (!ticket) {
      req.flash('error', 'Ticket not found');
      return res.redirect('/artists/manage-tickets');
    }

    // Check if the artist owns the concert associated with this ticket
    const artist = await Artist.findOne({ user: req.session.user.id });

    if (!artist || !ticket.concert || ticket.concert.artist.toString() !== artist._id.toString()) {
      req.flash('error', 'You do not have permission to view this ticket');
      return res.redirect('/artists/manage-tickets');
    }

    res.render('artists/ticket-view', {
      layout: false,
      currentPath: '/artists/manage-tickets',
      title: 'Ticket Details',
      artist,
      ticket
    });
  } catch (error) {
    console.error('View ticket page error:', error);
    req.flash('error', 'Failed to load ticket details');
    res.redirect('/artists/manage-tickets');
  }
});

// Delete ticket confirmation page
router.get('/tickets/:id/delete', isLoggedIn, isArtist, async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
    const ticket = await Ticket.findById(req.params.id)
      .populate('concert')
      .populate('user', 'name email');

    if (!ticket) {
      req.flash('error', 'Ticket not found');
      return res.redirect('/artists/manage-tickets');
    }

    // Check if the artist owns the concert associated with this ticket
    const artist = await Artist.findOne({ user: req.session.user.id });

    if (!artist || !ticket.concert || ticket.concert.artist.toString() !== artist._id.toString()) {
      req.flash('error', 'You do not have permission to delete this ticket');
      return res.redirect('/artists/manage-tickets');
    }

    res.render('artists/delete-ticket', {
      layout: false,
      currentPath: '/artists/tickets/delete',
      title: 'Delete Ticket Confirmation',
      artist,
      ticket
    });
  } catch (error) {
    console.error('Delete ticket confirmation page error:', error);
    req.flash('error', 'Failed to load delete confirmation page');
    res.redirect('/artists/manage-tickets');
  }
});

// Process ticket deletion
router.post('/tickets/:id/delete', isLoggedIn, isArtist, async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
    const ticket = await Ticket.findById(req.params.id).populate('concert');

    if (!ticket) {
      req.flash('error', 'Ticket not found');
      return res.redirect('/artists/manage-tickets');
    }

    // Check if the artist owns the concert associated with this ticket
    const artist = await Artist.findOne({ user: req.session.user.id });

    if (!artist || !ticket.concert || ticket.concert.artist.toString() !== artist._id.toString()) {
      req.flash('error', 'You do not have permission to delete this ticket');
      return res.redirect('/artists/manage-tickets');
    }

    // Delete the ticket
    await Ticket.findByIdAndDelete(req.params.id);

    req.flash('success', 'Ticket deleted successfully');
    res.redirect('/artists/manage-tickets');
  } catch (error) {
    console.error('Delete ticket error:', error);
    req.flash('error', 'Failed to delete ticket');
    res.redirect('/artists/manage-tickets');
  }
});

// Delete content confirmation page
router.get('/content/:id/delete', isLoggedIn, isArtist, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);

    if (!content) {
      req.flash('error', 'Content not found');
      return res.redirect('/artists/manage-content');
    }

    const artist = await Artist.findOne({ user: req.session.user.id }).populate('user');

    // Check if the artist owns this content
    if (content.artist.toString() !== artist._id.toString()) {
      req.flash('error', 'You do not have permission to delete this content');
      return res.redirect('/artists/manage-content');
    }

    res.render('artists/delete-content', {
      layout: false,
      currentPath: '/artists/content/delete',
      title: 'Delete Content',
      artist,
      content
    });
  } catch (error) {
    console.error('Delete content page error:', error);
    req.flash('error', 'Failed to load delete page');
    res.redirect('/artists/manage-content');
  }
});

// Delete content process
router.post('/content/:id/delete', isLoggedIn, isArtist, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);

    if (!content) {
      req.flash('error', 'Content not found');
      return res.redirect('/artists/manage-content');
    }

    const artist = await Artist.findOne({ user: req.session.user.id });

    // Check if the artist owns this content
    if (content.artist.toString() !== artist._id.toString()) {
      req.flash('error', 'You do not have permission to delete this content');
      return res.redirect('/artists/manage-content');
    }

    // Delete content
    await Content.findByIdAndDelete(req.params.id);

    req.flash('success', 'Content deleted successfully');
    res.redirect('/artists/manage-content');
  } catch (error) {
    console.error('Delete content error:', error);
    req.flash('error', 'Failed to delete content');
    res.redirect('/artists/manage-content');
  }
});

// Edit artist profile
router.get('/edit-profile', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id })
      .populate('user');

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    res.render('artists/edit-profile-new', {
      layout: false,
      currentPath: '/artists/edit-profile',
      title: 'Edit Profile',
      artist
    });
  } catch (error) {
    console.error('Edit artist profile error:', error);
    req.flash('error', 'Failed to load profile');
    res.redirect('/artists/dashboard');
  }
});

// Update artist profile
router.post('/update-profile', isLoggedIn, isArtist, upload.single('bannerImage'), async (req, res) => {
  try {
    const { stageName, genre, yearsActive, about, achievements } = req.body;

    const artist = await Artist.findOne({ user: req.session.user.id }).populate('bannerMedia');

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    // Update artist fields
    artist.stageName = stageName;
    artist.genre = genre;
    artist.yearsActive = yearsActive || 0;
    artist.about = about || '';

    // Update achievements
    if (achievements) {
      artist.achievements = achievements.split(',').map(a => a.trim());
    }

    // Update banner image if uploaded to Cloudinary
    if (req.file) {
      try {
        // Delete old banner image from Cloudinary if it exists
        if (artist.bannerMedia) {
          await deleteMedia(artist.bannerMedia);
        }

        // Upload new banner to Cloudinary
        const { media } = await uploadFileToCloudinary(req.file, {
          module: 'artistProfile',
          ownerType: 'artist',
          ownerId: artist._id,
          folder: 'rapira/artist-profile/banners'
        });

        artist.bannerImage = media.secure_url;
        artist.bannerMedia = media._id;
      } catch (err) {
        console.error('Banner image upload error:', err);
        req.flash('warning', 'Profile updated, but banner image upload failed.');
      }
    }

    await artist.save();

    req.flash('success', 'Artist profile updated successfully');
    res.redirect('/artists/dashboard');
  } catch (error) {
    console.error('Update artist profile error:', error);
    req.flash('error', 'Failed to update profile');
    res.redirect('/artists/edit-profile');
  }
});

// Artist followers management page
router.get('/followers', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id })
      .populate('user');

    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    // Get artist's followers with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const type = req.query.type; // 'all', 'user', 'artist'

    let query = { followingId: req.session.user.id };
    if (type === 'user') query.roleOfFollower = 'user';
    else if (type === 'artist') query.roleOfFollower = 'artist';

    const followersRaw = await Follow.find(query)
      .populate('followerId', 'name email profileImage role isBlocked')
      .sort({ createdAt: -1 });

    const validFollowers = followersRaw.filter(follow => follow.followerId && !follow.followerId.isBlocked);
    const artistFollowerIds = validFollowers
      .filter(follow => follow.followerId.role === 'artist')
      .map(follow => follow.followerId._id);
    const blockedArtistUsers = artistFollowerIds.length
      ? await Artist.find({ user: { $in: artistFollowerIds }, isBlocked: true }).select('user')
      : [];
    const blockedArtistUserIds = new Set(blockedArtistUsers.map(item => item.user.toString()));
    const activeFollowers = validFollowers.filter(follow => {
      if (follow.followerId.role !== 'artist') return true;
      return !blockedArtistUserIds.has(follow.followerId._id.toString());
    });

    const uniqueFollowers = new Map();
    activeFollowers.forEach(follow => {
      const followerId = follow.followerId._id.toString();
      if (!uniqueFollowers.has(followerId)) {
        uniqueFollowers.set(followerId, follow);
      }
    });

    const uniqueFollows = Array.from(uniqueFollowers.values());
    const totalFollowers = uniqueFollows.length;
    const followers = uniqueFollows.slice((page - 1) * limit, page * limit);

    // Get follower counts (exclude missing/blocked users)
    const allFollowersRaw = await Follow.find({ followingId: req.session.user.id })
      .populate('followerId', 'role isBlocked');
    const validAllFollowers = allFollowersRaw.filter(follow => follow.followerId && !follow.followerId.isBlocked);
    const allArtistFollowerIds = validAllFollowers
      .filter(follow => follow.followerId.role === 'artist')
      .map(follow => follow.followerId._id);
    const blockedAllArtistUsers = allArtistFollowerIds.length
      ? await Artist.find({ user: { $in: allArtistFollowerIds }, isBlocked: true }).select('user')
      : [];
    const blockedAllArtistUserIds = new Set(blockedAllArtistUsers.map(item => item.user.toString()));
    const activeAllFollowers = validAllFollowers.filter(follow => {
      if (follow.followerId.role !== 'artist') return true;
      return !blockedAllArtistUserIds.has(follow.followerId._id.toString());
    });
    const uniqueAllFollowers = new Map();
    activeAllFollowers.forEach(follow => {
      const followerId = follow.followerId._id.toString();
      if (!uniqueAllFollowers.has(followerId)) {
        uniqueAllFollowers.set(followerId, follow);
      }
    });

    const uniqueAllFollows = Array.from(uniqueAllFollowers.values());
    const followerCounts = {
      totalFollowers: uniqueAllFollows.length,
      userFollowers: uniqueAllFollows.filter(follow => follow.roleOfFollower === 'user').length,
      artistFollowers: uniqueAllFollows.filter(follow => follow.roleOfFollower === 'artist').length
    };

    res.render('artists/followers', {
      layout: false,
      currentPath: '/artists/followers',
      title: 'Manage Followers',
      artist,
      followers,
      followerCounts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalFollowers / limit),
        totalItems: totalFollowers,
        hasNext: page < Math.ceil(totalFollowers / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Artist followers error:', error);
    req.flash('error', 'Failed to load followers');
    res.redirect('/artists/dashboard');
  }
});

// ===== ARTIST BEAT MARKETPLACE ROUTES =====

// GET - View all available producer beats for an artist
router.get('/beats', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id }).populate('user');
    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    // Get settings for commission info
    const settings = await WebsiteSettings.getSettings();
    const commissionPct = settings.producerBeatCommissionSettings ? settings.producerBeatCommissionSettings.percentage : 4;

    const { producerId, searchQuery, statusFilter } = req.query;

    // Build query filter
    const query = { isActive: true, isBanned: false };
    if (producerId) query.producer = producerId;
    if (searchQuery) query.title = { $regex: searchQuery, $options: 'i' };

    // Mark beats the artist has already purchased (ignoring deleted receipts so they can repurchase)
    const purchases = await BeatPurchase.find({ artist: req.session.user.id, status: 'completed', isDeletedByArtist: { $ne: true } });
    const purchasedBeatIds = purchases.filter(p => p.beat).map(p => p.beat.toString());

    // Get all active, unbanned beats with filters
    const allBeats = await ProducerBeat.find(query)
      .populate('producer', 'name profileImage')
      .sort({ createdAt: -1 });

    // Identify current producers (users who have the producer role)
    const producerRole = await Role.findOne({ name: { $regex: '^producer$', $options: 'i' } });
    const currentProducerRoles = await UserRole.find({ role: producerRole._id }).select('user');
    const activeProducerIds = currentProducerRoles.map(ur => ur.user.toString());

    // Filter beats: Keep if producer is active OR if the artist already purchased it
    const beats = allBeats.filter(b => {
      // If producer is missing (deleted user), only keep if purchased
      if (!b.producer) {
        return purchasedBeatIds.includes(b._id.toString());
      }

      const producerId = b.producer._id.toString();
      const isPurchased = purchasedBeatIds.includes(b._id.toString());
      const isProducerActive = activeProducerIds.includes(producerId);

      // Keep if producer still has the role OR artist bought it already
      return isProducerActive || isPurchased;
    });

    // Identify unique producers for the filter dropdown (only from the filtered list)
    const uniqueProducersMap = new Map();
    beats.forEach(b => {
      if (b.producer && !uniqueProducersMap.has(b.producer._id.toString())) {
        uniqueProducersMap.set(b.producer._id.toString(), { id: b.producer._id, name: b.producer.name });
      }
    });
    const producersList = Array.from(uniqueProducersMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    // Filter by purchase status
    if (statusFilter === 'purchased') {
      beats = beats.filter(b => purchasedBeatIds.includes(b._id.toString()));
    } else if (statusFilter === 'available') {
      beats = beats.filter(b => !purchasedBeatIds.includes(b._id.toString()));
    } else if (statusFilter === 'free') {
      beats = beats.filter(b => b.price === 0);
    }

    res.render('artists/beats', {
      layout: false,
      title: 'Producer Beats Marketplace',
      currentPath: '/artists/beats',
      artist,
      beats,
      purchasedBeatIds,
      commissionPct,
      producersList,
      filters: { producerId, searchQuery, statusFilter },
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error fetching beats for artist:', error);
    req.flash('error', 'Failed to load beats marketplace');
    res.redirect('/artists/dashboard');
  }
});

// GET - View specific beat details
router.get('/beats/:id', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id }).populate('user');
    const beat = await ProducerBeat.findById(req.params.id).populate('producer', 'name email profileImage');

    if (!beat || !beat.isActive || beat.isBanned) {
      req.flash('error', 'Beat not found or unavailable');
      return res.redirect('/artists/beats');
    }

    // Check for existing purchase first
    const existingPurchase = await BeatPurchase.findOne({
      beat: beat._id,
      artist: req.session.user.id,
      status: 'completed',
      isDeletedByArtist: { $ne: true }
    });

    // Check if producer is still active (has producer role)
    let isProducerActive = false;
    if (beat.producer) {
      const producerRole = await Role.findOne({ name: { $regex: '^producer$', $options: 'i' } });
      const hasRole = await UserRole.findOne({ user: beat.producer._id, role: producerRole._id });
      isProducerActive = !!hasRole;
    }

    // If producer is gone/inactive AND artist hasn't purchased it, deny access
    if (!isProducerActive && !existingPurchase) {
      req.flash('error', 'This beat is no longer available as the producer is inactive.');
      return res.redirect('/artists/beats');
    }

    const settings = await WebsiteSettings.getSettings();
    const commissionPct = settings.producerBeatCommissionSettings ? settings.producerBeatCommissionSettings.percentage : 4;

    res.render('artists/beat-details', {
      layout: false,
      title: beat.title,
      currentPath: '/artists/beats',
      artist,
      beat,
      isPurchased: !!existingPurchase,
      commissionPct,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error fetching beat details:', error);
    req.flash('error', 'Failed to load beat details');
    res.redirect('/artists/beats');
  }
});

// GET - Stream beat (protected)
router.get('/beats/stream/:id', isLoggedIn, isArtist, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const isAdminUser = req.session.user.role === 'admin' || req.session.user.role === 'superAdmin';

    let beat = await ProducerBeat.findById(req.params.id);
    let streamUrl;
    let isAuthorized = false;

    if (beat) {
      if (beat.isBanned && !isAdminUser) {
        return res.status(403).send('Beat is banned');
      }

      const isProducer = beat.producer && beat.producer.toString() === userId;
      const existingPurchase = await BeatPurchase.findOne({
        beat: beat._id,
        artist: userId,
        status: 'completed',
        isDeletedByArtist: { $ne: true }
      });

      isAuthorized = isProducer || isAdminUser || !!existingPurchase;
      streamUrl = beat.mediaUrl;
    } else {
      // Check if it's a purchase record ID (for deleted beats in library)
      const purchase = await BeatPurchase.findById(req.params.id);
      if (!purchase) {
        return res.status(404).send('Media not found');
      }

      // Check ownership
      if (purchase.artist.toString() !== userId && !isAdminUser) {
        return res.status(403).send('Unauthorized access to library item');
      }

      streamUrl = purchase.backupMediaUrl;
      isAuthorized = true; // Ownership verified above
    }

    if (!streamUrl) {
      return res.status(404).send('Media URL missing');
    }

    // Apply preview restriction if not authorized
    if (!isAuthorized) {
      if (streamUrl.includes('res.cloudinary.com')) {
        // Truncate to first 30 seconds for preview
        streamUrl = streamUrl.replace('/upload/', '/upload/so_0,du_30/');
      }
    }

    // Proxy the request to Cloudinary to hide the direct URL and check permissions
    const range = req.headers.range;
    const axiosConfig = {
      responseType: 'stream',
      headers: {
        'User-Agent': req.headers['user-agent']
      }
    };

    if (range) {
      axiosConfig.headers.Range = range;
    }

    const response = await axios.get(streamUrl, axiosConfig);

    // Set appropriate status (especially 206 for partial content)
    res.status(response.status);

    // Forward relevant headers
    const forwardedHeaders = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
      'last-modified',
      'etag'
    ];

    forwardedHeaders.forEach(header => {
      if (response.headers[header]) {
        res.setHeader(header, response.headers[header]);
      }
    });

    // Ensure it's not downloaded automatically in browser
    res.setHeader('Content-Disposition', 'inline');

    // Pipe the data
    response.data.pipe(res);
  } catch (error) {
    if (error.response && error.response.status === 416) {
      return res.sendStatus(416);
    }
    console.error('Beat stream error:', error.message);
    res.status(500).send('Error streaming media');
  }
});

// GET - Download beat (authorized only)
router.get('/beats/download/:id', isLoggedIn, isArtist, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const isAdminUser = req.session.user.role === 'admin' || req.session.user.role === 'superAdmin';

    let beat = await ProducerBeat.findById(req.params.id);
    let downloadUrl;
    let title = 'beat';
    let mediaType = 'audio';

    if (beat) {
      const isProducer = beat.producer && beat.producer.toString() === userId;
      const existingPurchase = await BeatPurchase.findOne({
        beat: beat._id,
        artist: userId,
        status: 'completed',
        isDeletedByArtist: { $ne: true }
      });

      if (!isProducer && !isAdminUser && !existingPurchase) {
        req.flash('error', 'You must purchase this beat to download it');
        return res.redirect(`/artists/beats/${beat._id}`);
      }

      downloadUrl = beat.mediaUrl;
      title = beat.title;
      mediaType = beat.mediaType;
    } else {
      // Check if it's a purchase record ID
      const purchase = await BeatPurchase.findById(req.params.id);
      if (!purchase) {
        return res.status(404).send('Download not found');
      }

      if (purchase.artist.toString() !== userId && !isAdminUser) {
        return res.status(403).send('Unauthorized');
      }

      downloadUrl = purchase.backupMediaUrl;
      title = purchase.backupTitle || 'beat';
      mediaType = purchase.backupMediaType || 'audio';
    }

    if (!downloadUrl) return res.status(404).send('File URL missing');

    const response = await axios.get(downloadUrl, { responseType: 'stream' });

    // Determine file extension
    let extension = 'mp3';
    if (mediaType === 'video') extension = 'mp4';
    else if (downloadUrl.split('?')[0].endsWith('.wav')) extension = 'wav';

    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', response.headers['content-type'] || (mediaType === 'video' ? 'video/mp4' : 'audio/mpeg'));

    response.data.pipe(res);
  } catch (error) {
    console.error('Beat download error:', error.message);
    res.status(500).send('Error downloading media');
  }
});

// POST - Create Razorpay order for a beat
router.post('/beats/:id/purchase', isLoggedIn, isArtist, async (req, res) => {
  try {
    const beat = await ProducerBeat.findById(req.params.id);
    if (!beat || !beat.isActive || beat.isBanned) {
      return res.status(400).json({ success: false, message: 'Beat is not available for purchase' });
    }

    // Check if already purchased
    const existingPurchase = await BeatPurchase.findOne({
      beat: beat._id,
      artist: req.session.user.id,
      status: 'completed',
      isDeletedByArtist: { $ne: true }
    });

    if (existingPurchase) {
      return res.status(400).json({ success: false, message: 'You have already purchased this beat' });
    }

    // Verify producer account and role still exist
    if (!beat.producer) {
      return res.status(400).json({ success: false, message: 'The producer for this beat no longer exists.' });
    }

    const producerRole = await Role.findOne({ name: { $regex: '^producer$', $options: 'i' } });
    const hasRole = await UserRole.findOne({ user: beat.producer, role: producerRole._id });

    if (!hasRole) {
      return res.status(400).json({ success: false, message: 'This producer is no longer active on the platform.' });
    }

    const settings = await WebsiteSettings.getSettings();
    const commissionPct = settings.producerBeatCommissionSettings ? settings.producerBeatCommissionSettings.percentage : 4;

    // Calculate fees
    const platformFee = beat.price * (commissionPct / 100);
    const totalAmountPaid = beat.price + platformFee;

    // Handle FREE beats directly to bypass Razorpay
    if (totalAmountPaid === 0) {
      const newFreePurchase = new BeatPurchase({
        beat: beat._id,
        artist: req.session.user.id,
        producer: beat.producer,
        amount: 0,
        platformFee: 0,
        totalAmountPaid: 0,
        paymentMethod: 'free',
        transactionId: 'FREE_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5).toUpperCase(),
        status: 'completed',
        backupTitle: beat.title,
        backupMediaType: beat.mediaType,
        backupMediaUrl: beat.mediaUrl
      });
      await newFreePurchase.save();

      beat.purchasesCount += 1;
      await beat.save();

      return res.json({ success: true, isFree: true, message: 'Free beat added to library successfully!' });
    }

    // Create Razorpay order for paid beats
    const { createOrder } = require('../utils/paymentService');
    const orderResult = await createOrder({
      amount: totalAmountPaid,
      receipt: `beat_${beat._id.toString().substring(0, 10)}`,
      notes: {
        type: 'beat_purchase',
        beatId: beat._id.toString(),
        artistId: req.session.user.id
      }
    });

    if (!orderResult.success) {
      return res.status(500).json({ success: false, message: orderResult.error || 'Failed to initialize payment' });
    }

    res.json({
      success: true,
      order: orderResult.data,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount: totalAmountPaid,
      beatId: beat._id
    });

  } catch (error) {
    console.error('Error initiating beat purchase:', error);
    res.status(500).json({ success: false, message: 'Server error initiating purchase' });
  }
});

// POST - Verify Razorpay payment for a beat
router.post('/beats/verify-payment', isLoggedIn, isArtist, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, beatId } = req.body;

    if (!beatId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.json({ success: false, message: 'Missing payment details' });
    }

    const { verifyPayment } = require('../utils/paymentService');
    const verification = verifyPayment({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    if (!verification.success) {
      return res.json({ success: false, message: 'Payment signature verification failed' });
    }

    const beat = await ProducerBeat.findById(beatId);
    if (!beat) {
      return res.json({ success: false, message: 'Beat not found' });
    }

    const settings = await WebsiteSettings.getSettings();
    const commissionPct = settings.producerBeatCommissionSettings ? settings.producerBeatCommissionSettings.percentage : 4;
    const platformFee = beat.price * (commissionPct / 100);
    const totalAmountPaid = beat.price + platformFee;

    const newPurchase = new BeatPurchase({
      beat: beat._id,
      artist: req.session.user.id,
      producer: beat.producer,
      amount: beat.price,
      platformFee,
      totalAmountPaid,
      paymentMethod: 'razorpay',
      transactionId: razorpay_payment_id,
      status: 'completed',
      backupTitle: beat.title,
      backupMediaType: beat.mediaType,
      backupMediaUrl: beat.mediaUrl
    });

    await newPurchase.save();

    beat.purchasesCount += 1;
    await beat.save();

    // Log the transaction for admin payments page
    const { logTransaction } = require('../utils/transactionLogger');
    await logTransaction({
      user: req.session.user.id,
      type: 'beat',
      amount: newPurchase.totalAmountPaid,
      platformFee: newPurchase.platformFee,
      payee: newPurchase.producer,
      paymentId: newPurchase.transactionId,
      orderId: razorpay_order_id,
      sourceModel: 'BeatPurchase',
      sourceId: newPurchase._id,
      description: `Beat purchase: ${newPurchase.backupTitle || 'Beat'}`
    });

    res.json({ success: true, message: 'Beat purchased successfully!' });

  } catch (error) {
    console.error('Error verifying beat payment:', error);
    res.json({ success: false, message: 'Server error processing payment verification' });
  }
});

// POST - Increment View Count (optional via AJAX)
router.post('/beats/:id/view', isLoggedIn, async (req, res) => {
  try {
    await ProducerBeat.findByIdAndUpdate(req.params.id, { $inc: { viewsCount: 1 } });
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false });
  }
});
// GET - View artist's purchased beats and receipts
router.get('/beat-purchases', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id });
    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    const purchases = await BeatPurchase.find({ artist: req.session.user.id, status: 'completed', isDeletedByArtist: { $ne: true } })
      .populate('producer', 'name email profileImage')
      .populate('beat', 'title mediaUrl mediaType')
      .sort({ createdAt: -1 });

    res.render('artists/beat-purchases', {
      layout: false,
      title: 'My Receipts',
      currentPath: '/artists/beat-purchases',
      artist,
      purchases,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error fetching beat purchases for artist:', error);
    req.flash('error', 'Failed to load purchased beats');
    res.redirect('/artists/dashboard');
  }
});

// GET - Beat Library (Media & Management)
router.get('/library', isLoggedIn, isArtist, async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.session.user.id }).populate('user');
    if (!artist) {
      req.flash('error', 'Artist profile not found');
      return res.redirect('/');
    }

    const purchases = await BeatPurchase.find({ artist: req.session.user.id, status: 'completed', isDeletedByArtist: { $ne: true } })
      .populate('producer', 'name email profileImage')
      .populate('beat', 'title mediaUrl mediaType')
      .sort({ createdAt: -1 });

    res.render('artists/library', {
      layout: false,
      title: 'Beat Library',
      currentPath: '/artists/library',
      artist,
      purchases,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error fetching beat library:', error);
    req.flash('error', 'Failed to load beat library');
    res.redirect('/artists/dashboard');
  }
});

// GET - View specific receipt for artist
router.get('/beat-purchases/:id/receipt', isLoggedIn, isArtist, async (req, res) => {
  try {
    const userRole = req.session.user.role;
    const isAdmin = userRole === 'admin' || userRole === 'superAdmin';

    // Prepare query: admins can see any receipt by ID, artists only their own
    const query = { _id: req.params.id };
    if (!isAdmin) {
      query.artist = req.session.user.id;
    }

    const purchase = await BeatPurchase.findOne(query)
      .populate('artist', 'name email')
      .populate('producer', 'name email')
      .populate('beat', 'title mediaType');

    if (!purchase) {
      req.flash('error', 'Receipt not found');
      return res.redirect(isAdmin ? '/admin/artist-beat-purchases' : '/artists/beat-purchases');
    }

    // Determine return URL: if admin, go back to the artist's detail page in admin panel
    const backUrl = isAdmin
      ? `/admin/artist-beat-purchases/artist/${purchase.artist._id}`
      : '/artists/beat-purchases';

    res.render('shared/receipt', {
      layout: false,
      purchase,
      backUrl
    });
  } catch (error) {
    console.error('Error fetching receipt:', error);
    req.flash('error', 'Failed to load receipt');
    const isAdmin = req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'superAdmin');
    res.redirect(isAdmin ? '/admin/artist-beat-purchases' : '/artists/beat-purchases');
  }
});

// POST - Delete artist receipt
router.post('/beat-purchases/:id/delete', isLoggedIn, isArtist, async (req, res) => {
  try {
    const purchase = await BeatPurchase.findOne({ _id: req.params.id, artist: req.session.user.id });
    if (!purchase) {
      req.flash('error', 'Receipt not found');
      return res.redirect('/artists/beat-purchases');
    }

    purchase.isDeletedByArtist = true;
    await purchase.save();

    req.flash('success', 'Receipt deleted from your dashboard');
    res.redirect('/artists/beat-purchases');
  } catch (error) {
    console.error('Error deleting receipt:', error);
    req.flash('error', 'Failed to delete receipt');
    res.redirect('/artists/beat-purchases');
  }
});

// View artist profile
router.get('/:id', async (req, res) => {
  try {
    // Check if this is a special route like 'upgrade-request'
    if (req.params.id === 'upgrade-request') {
      return res.redirect('/artist-upgrade/request');
    }

    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.isValidObjectId(req.params.id)) {
      req.flash('error', 'Invalid artist ID');
      return res.redirect('/artists');
    }

    // Otherwise, try to find the artist by ID
    const artist = await Artist.findById(req.params.id)
      .populate('user');

    if (!artist) {
      req.flash('error', 'Artist not found');
      return res.redirect('/artists');
    }

    // Check if artist is blocked
    if (artist.isBlocked) {
      return res.render('artists/profile-blocked', {
        artist,
        blockReason: artist.blockReason || 'This artist has been banned.',
        layout: false
      });
    }

    // Get follower counts
    const followerCounts = await artist.populateFollowerCounts();

    // Get artist's content
    const content = await Content.find({ artist: artist._id })
      .sort({ createdAt: -1 });

    // Get upcoming concerts
    const upcomingConcerts = await Concert.find({
      artist: artist._id,
      status: 'approved',
      date: { $gte: new Date() }
    }).populate('venue').sort({ date: 1 });

    // Get artist's approved posts
    const ArtistPost = require('../models/ArtistPost');
    const posts = await ArtistPost.find({
      artist: artist._id,
      isActive: true,
      isApproved: true
    })
      .populate('likes', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(50);

    // Check if current user is following this artist
    let isFollowing = false;
    let currentUser = null;
    if (req.session.user) {
      currentUser = req.session.user;
      const Follow = require('../models/Follow');
      const existingFollow = await Follow.findOne({
        followerId: req.session.user.id,
        followingId: artist.user._id
      });
      isFollowing = !!existingFollow;
    }

    res.render('artists/profile', {
      artist,
      content,
      upcomingConcerts,
      followerCounts,
      posts,
      isFollowing,
      currentUser,
      message: req.query.message || null
    });
  } catch (error) {
    console.error('Artist profile error:', error);
    req.flash('error', 'Failed to load artist profile');
    res.redirect('/artists');
  }
});

// Artist Posts Gallery
router.get('/:id/posts-gallery', async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id).populate('user');

    if (!artist) {
      req.flash('error', 'Artist not found');
      return res.redirect('/artists');
    }

    res.render('artists/posts-gallery', {
      artist,
      user: req.session.user || null,
      message: req.query.message || null
    });
  } catch (error) {
    console.error('Posts gallery error:', error);
    req.flash('error', 'Failed to load posts');
    res.redirect('/artists');
  }
});

// Submit unblock request
router.post('/request-unblock', isLoggedIn, isArtist, async (req, res) => {
  try {
    const { message } = req.body;
    const artist = await Artist.findOne({ user: req.session.user.id });

    if (!artist) {
      return res.json({ success: false, message: 'Artist profile not found' });
    }

    if (!artist.isBlocked) {
      return res.json({ success: false, message: 'Your account is not blocked' });
    }

    // Check if there's already a pending request
    const existingRequest = await ArtistUnblockRequest.findOne({
      artist: artist._id,
      status: 'pending'
    });

    if (existingRequest) {
      return res.json({ success: false, message: 'You already have a pending unblock request' });
    }

    // Create new unblock request
    const unblockRequest = new ArtistUnblockRequest({
      artist: artist._id,
      user: req.session.user.id,
      message: message || 'Please unblock my account'
    });

    await unblockRequest.save();

    res.json({ success: true, message: 'Unblock request submitted successfully. Admin will review it soon.' });
  } catch (error) {
    console.error('Submit unblock request error:', error);
    res.json({ success: false, message: 'Failed to submit unblock request' });
  }
});

module.exports = router;
