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
    { name: 'contentFile', maxCount: 1 },
    { name: 'thumbnailImage', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { title, type, description } = req.body;

      // Validate input
      if (!title || !type) {
        req.flash('error', 'Please provide title and content type');
        return res.redirect('/artists/upload-content');
      }

      if (!req.files.contentFile) {
        req.flash('error', 'Please upload a file');
        return res.redirect('/artists/upload-content');
      }

      // Validate file type matches content type
      const file = req.files.contentFile[0];
      const fileType = file.mimetype;

      // Define allowed file types for each content type
      const allowedFileTypes = {
        song: ['audio/mpeg', 'audio/wav', 'audio/mp3'],
        video: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
        lyrics: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      };

      // Check if file type is allowed for the selected content type
      if (!allowedFileTypes[type].includes(fileType)) {
        // Delete the uploaded file
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error('Error deleting invalid file:', err);
        }

        // Show error message
        req.flash('error', `Invalid file type for ${type}. Please upload ${type === 'song' ? 'MP3/WAV' : type === 'video' ? 'MP4/MOV' : 'PDF/DOC/DOCX'} files only.`);
        return res.redirect('/artists/upload-content');
      }

      const artist = await Artist.findOne({ user: req.session.user.id });

      if (!artist) {
        req.flash('error', 'Artist profile not found');
        return res.redirect('/');
      }

      // Create content
      const contentFilePath = getStoragePath('content', req.files.contentFile[0].filename);

      const newContent = new Content({
        artist: artist._id,
        title,
        type,
        description: description || '',
        fileUrl: contentFilePath
      });

      // Set thumbnail if uploaded
      if (req.files.thumbnailImage) {
        const thumbnailPath = getStoragePath('thumbnails', req.files.thumbnailImage[0].filename);
        newContent.thumbnailUrl = thumbnailPath;
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
    { name: 'contentFile', maxCount: 1 },
    { name: 'thumbnailImage', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { title, description } = req.body;

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

      // Validate file type matches content type if a new file is uploaded
      if (req.files.contentFile) {
        const file = req.files.contentFile[0];
        const fileType = file.mimetype;
        const contentType = content.type; // Get the existing content type

        // Define allowed file types for each content type
        const allowedFileTypes = {
          song: ['audio/mpeg', 'audio/wav', 'audio/mp3'],
          video: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
          lyrics: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        };

        // Check if file type is allowed for the content type
        if (!allowedFileTypes[contentType].includes(fileType)) {
          // Delete the uploaded file
          try {
            fs.unlinkSync(file.path);
          } catch (err) {
            console.error('Error deleting invalid file:', err);
          }

          // Show error message
          req.flash('error', `Invalid file type for ${contentType}. Please upload ${contentType === 'song' ? 'MP3/WAV' : contentType === 'video' ? 'MP4/MOV' : 'PDF/DOC/DOCX'} files only.`);
          return res.redirect(`/artists/content/${req.params.id}/edit`);
        }
      }

      // Update content fields
      content.title = title;
      content.description = description || '';

      // Update content file if uploaded
      if (req.files.contentFile) {
        const contentFilePath = getStoragePath('content', req.files.contentFile[0].filename);
        content.fileUrl = contentFilePath;
      }

      // Update thumbnail if uploaded
      if (req.files.thumbnailImage) {
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