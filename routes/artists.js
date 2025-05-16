const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Artist = require('../models/Artist');
const Content = require('../models/Content');
const Concert = require('../models/Concert');
const { isLoggedIn, isArtist } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getFileUrl, getStoragePath } = require('../utils/fileHelper');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;

    if (file.fieldname === 'bannerImage') {
      uploadPath = path.join(__dirname, '../public/uploads/banners');
    } else if (file.fieldname === 'contentFile') {
      uploadPath = path.join(__dirname, '../public/uploads/content');
    } else if (file.fieldname === 'thumbnailImage') {
      uploadPath = path.join(__dirname, '../public/uploads/thumbnails');
    } else {
      uploadPath = path.join(__dirname, '../public/uploads/misc');
    }

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);

    if (file.fieldname === 'bannerImage') {
      cb(null, 'banner-' + uniqueSuffix + ext);
    } else if (file.fieldname === 'contentFile') {
      cb(null, 'content-' + uniqueSuffix + ext);
    } else if (file.fieldname === 'thumbnailImage') {
      cb(null, 'thumbnail-' + uniqueSuffix + ext);
    } else {
      cb(null, 'file-' + uniqueSuffix + ext);
    }
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'contentFile') {
      // For content files, allow audio, video, and document files
      const filetypes = /mp3|wav|mp4|mov|pdf|doc|docx/;
      const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

      if (extname) {
        return cb(null, true);
      } else {
        cb(new Error('Only audio, video, and document files are allowed'));
      }
    } else {
      // For images, only allow image files
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
    // Get only artists with valid user references
    const artists = await Artist.find()
      .populate('user', 'name profileImage')
      .then(artists => artists.filter(artist => artist.user));

    res.render('artists/index', { artists });
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

    // Get artist's concerts
    const concerts = await Concert.find({ artist: artist._id })
      .sort({ date: -1 });

    // Get artist's content
    const content = await Content.find({ artist: artist._id })
      .sort({ createdAt: -1 });

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

// Upload content process
router.post('/upload-content', isLoggedIn, isArtist,
  upload.fields([
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

      // Set thumbnail if uploaded
      if (req.files && req.files.thumbnailImage) {
        const thumbnailPath = getStoragePath('thumbnails', req.files.thumbnailImage[0].filename);
        newContent.thumbnailUrl = thumbnailPath;
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
  upload.fields([
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

      const content = await Content.findById(req.params.id);

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

      // Update thumbnail if uploaded
      if (req.files && req.files.thumbnailImage) {
        const thumbnailPath = getStoragePath('thumbnails', req.files.thumbnailImage[0].filename);
        content.thumbnailUrl = thumbnailPath;
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

    // Get artist's content
    const content = await Content.find({ artist: artist._id })
      .sort({ createdAt: -1 });

    res.render('artists/manage-content', {
      layout: false,
      currentPath: '/artists/manage-content',
      title: 'Manage Content',
      artist,
      content
    });
  } catch (error) {
    console.error('Manage content page error:', error);
    req.flash('error', 'Failed to load content management page');
    res.redirect('/artists/dashboard');
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

    // Get artist's concerts
    const concerts = await Concert.find({ artist: artist._id })
      .sort({ date: -1 });

    res.render('artists/manage-concerts', {
      layout: false,
      currentPath: '/artists/manage-concerts',
      title: 'Manage Concerts',
      artist,
      concerts,
      upcomingConcerts: concerts.filter(c => new Date(c.date) >= new Date() && c.status === 'approved'),
      pendingConcerts: concerts.filter(c => c.status === 'pending'),
      rejectedConcerts: concerts.filter(c => c.status === 'rejected'),
      pastConcerts: concerts.filter(c => new Date(c.date) < new Date() && c.status === 'approved')
    });
  } catch (error) {
    console.error('Manage concerts page error:', error);
    req.flash('error', 'Failed to load concert management page');
    res.redirect('/artists/dashboard');
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

    // Get artist's concerts
    const concerts = await Concert.find({ artist: artist._id });

    // Get all tickets for the artist's concerts
    const Ticket = require('../models/Ticket');
    const tickets = await Ticket.find({
      concert: { $in: concerts.map(c => c._id) },
      paymentStatus: 'completed'
    })
      .populate('concert')
      .populate('user', 'name email')
      .sort({ purchaseDate: -1 });

    res.render('artists/manage-tickets', {
      layout: false,
      currentPath: '/artists/manage-tickets',
      title: 'Manage Tickets',
      artist,
      tickets,
      concerts
    });
  } catch (error) {
    console.error('Manage tickets page error:', error);
    req.flash('error', 'Failed to load ticket management page');
    res.redirect('/artists/dashboard');
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

    const artist = await Artist.findOne({ user: req.session.user.id });

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

    // Update banner image if uploaded
    if (req.file) {
      // Delete old banner image if it's not the default
      if (artist.bannerImage && artist.bannerImage !== '/images/default-banner.jpg') {
        const oldImagePath = path.join(__dirname, '../public', artist.bannerImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Set new banner image
      artist.bannerImage = '/uploads/banners/' + req.file.filename;
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

// View artist profile
router.get('/:id', async (req, res) => {
  try {
    // Check if this is a special route like 'upgrade-request'
    if (req.params.id === 'upgrade-request') {
      return res.redirect('/artist-upgrade/request');
    }

    // Otherwise, try to find the artist by ID
    const artist = await Artist.findById(req.params.id)
      .populate('user');

    if (!artist) {
      req.flash('error', 'Artist not found');
      return res.redirect('/artists');
    }

    // Get artist's content
    const content = await Content.find({ artist: artist._id })
      .sort({ createdAt: -1 });

    // Get upcoming concerts
    const upcomingConcerts = await Concert.find({
      artist: artist._id,
      status: 'approved',
      date: { $gte: new Date() }
    }).sort({ date: 1 });

    res.render('artists/profile', {
      artist,
      content,
      upcomingConcerts
    });
  } catch (error) {
    console.error('Artist profile error:', error);
    req.flash('error', 'Failed to load artist profile');
    res.redirect('/artists');
  }
});

module.exports = router;