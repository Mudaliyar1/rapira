
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const Content = require('../models/Content');
const Artist = require('../models/Artist');
const { getFileUrl, getStoragePath } = require('../utils/fileHelper');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'public/uploads/content';

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Create a more comprehensive file filter
const fileFilter = (req, file, cb) => {
  // Define allowed file types by category
  const allowedTypes = {
    image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac'],
    video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
  };

  // Combine all allowed types
  const allAllowedMimeTypes = [
    ...allowedTypes.image,
    ...allowedTypes.audio,
    ...allowedTypes.video,
    ...allowedTypes.document
  ];

  // Check if the file's mimetype is in our allowed list
  if (allAllowedMimeTypes.includes(file.mimetype)) {
    return cb(null, true);
  }

  // For thumbnails, only allow images
  if (file.fieldname === 'thumbnailFile' && !allowedTypes.image.includes(file.mimetype)) {
    return cb(new Error('Thumbnail must be an image file (JPEG, PNG, GIF)'));
  }

  // For content files, check based on the content type if available
  if (file.fieldname === 'contentFile' && req.body.type) {
    const contentType = req.body.type;

    if (contentType === 'song' && !allowedTypes.audio.includes(file.mimetype)) {
      return cb(new Error('Song content must be an audio file (MP3, WAV)'));
    }

    if (contentType === 'video' && !allowedTypes.video.includes(file.mimetype)) {
      return cb(new Error('Video content must be a video file (MP4, MOV)'));
    }

    if (contentType === 'lyrics' && !allowedTypes.document.includes(file.mimetype)) {
      return cb(new Error('Lyrics content must be a document file (PDF, DOC, DOCX)'));
    }
  }

  // If we get here, the file type is not allowed
  cb(new Error(`Unsupported file type: ${file.mimetype}. Please upload a valid file.`));
};

// Configure multer with error handling
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: fileFilter
}).fields([
  { name: 'thumbnailFile', maxCount: 1 },
  { name: 'contentFile', maxCount: 1 }
]);

// Add content form
router.get('/add', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get all artists for the dropdown
    const artists = await Artist.find()
      .populate('user', 'name')
      .sort({ 'user.name': 1 });

    res.render('admin/content-add', {
      layout: 'admin',
      currentPath: '/admin/content',
      title: 'Add New Content',
      artists
    });
  } catch (error) {
    console.error('Add content form error:', error);
    req.flash('error', 'Failed to load add content form');
    res.redirect('/admin/content');
  }
});

// Add content process
router.post('/add', isLoggedIn, isAdmin, (req, res, next) => {
  upload(req, res, function(err) {
    if (err) {
      console.error('Upload error:', err);
      req.flash('error', err.message || 'File upload failed');
      return res.redirect('/admin/content/add');
    }
    next();
  });
}, async (req, res) => {
  try {
    const { title, description, type, artist, featured, tags, releaseDate, lyrics } = req.body;

    // Validate required fields
    if (!title || !type || !artist) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/admin/content/add');
    }

    // Validate file uploads
    if (!req.files || !req.files.contentFile) {
      req.flash('error', 'Please upload a content file');
      return res.redirect('/admin/content/add');
    }

    // Create new content
    const contentFilePath = getStoragePath('content', req.files.contentFile[0].filename);

    const newContent = new Content({
      title,
      description: description || '',
      type,
      artist,
      featured: featured === 'on',
      fileUrl: contentFilePath
    });

    // Add tags if provided
    if (tags) {
      newContent.tags = tags.split(',').map(tag => tag.trim());
    }

    // Add release date if provided
    if (releaseDate) {
      newContent.releaseDate = new Date(releaseDate);
    }

    // Add lyrics if provided and content type is lyrics
    if (type === 'lyrics' && lyrics) {
      newContent.lyrics = lyrics;
    }

    // Add thumbnail if provided
    if (req.files.thumbnailFile && req.files.thumbnailFile[0]) {
      const thumbnailPath = getStoragePath('content', req.files.thumbnailFile[0].filename);
      newContent.thumbnailUrl = thumbnailPath;
    }

    await newContent.save();

    req.flash('success', 'Content added successfully');
    res.redirect('/admin/content');
  } catch (error) {
    console.error('Add content error:', error);
    req.flash('error', 'Failed to add content');
    res.redirect('/admin/content/add');
  }
});

// Manage content
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const content = await Content.find()
      .sort({ createdAt: -1 })
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      });

    res.render('admin/content', {
      layout: 'admin',
      currentPath: '/admin/content',
      title: 'Manage Content',
      content
    });
  } catch (error) {
    console.error('Manage content error:', error);
    req.flash('error', 'Failed to load content');
    res.redirect('/admin');
  }
});

// View content details
router.get('/:id/details', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name email' }
      });

    if (!content) {
      req.flash('error', 'Content not found');
      return res.redirect('/admin/content');
    }

    res.render('admin/content-details', {
      layout: 'admin',
      currentPath: '/admin/content',
      title: `Content: ${content.title}`,
      content
    });
  } catch (error) {
    console.error('Content details error:', error);
    req.flash('error', 'Failed to load content details');
    res.redirect('/admin/content');
  }
});

// Edit content form
router.get('/:id/edit', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      });

    if (!content) {
      req.flash('error', 'Content not found');
      return res.redirect('/admin/content');
    }

    // Get all artists for the dropdown
    const artists = await Artist.find()
      .populate('user', 'name')
      .sort({ 'user.name': 1 });

    res.render('admin/content-edit', {
      layout: 'admin',
      currentPath: '/admin/content',
      title: `Edit Content: ${content.title}`,
      content,
      artists
    });
  } catch (error) {
    console.error('Edit content error:', error);
    req.flash('error', 'Failed to load content edit form');
    res.redirect('/admin/content');
  }
});

// Middleware to handle multer errors
const handleMulterErrors = (req, res, next) => {
  return (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading
      console.error('Multer error:', err);
      req.flash('error', `Upload error: ${err.message}`);
      return res.redirect('back');
    } else if (err) {
      // An unknown error occurred when uploading
      console.error('Upload error:', err);
      req.flash('error', err.message || 'File upload failed');
      return res.redirect('back');
    }

    // No errors, continue
    next();
  };
};

// Update content
router.post('/:id/update', isLoggedIn, isAdmin, (req, res, next) => {
  upload(req, res, function(err) {
    if (err) {
      console.error('Upload error:', err);
      req.flash('error', err.message || 'File upload failed');
      return res.redirect('back');
    }
    next();
  });
}, async (req, res) => {
  try {
    const { title, description, type, artist, featured, tags, releaseDate, lyrics } = req.body;

    // Find content
    const content = await Content.findById(req.params.id);

    if (!content) {
      req.flash('error', 'Content not found');
      return res.redirect('/admin/content');
    }

    // Validate file type matches content type if a new file is uploaded
    if (req.files && req.files.contentFile && req.files.contentFile[0]) {
      const file = req.files.contentFile[0];
      const fileType = file.mimetype;

      // Define allowed file types for each content type
      const allowedFileTypes = {
        song: ['audio/mpeg', 'audio/wav', 'audio/mp3'],
        video: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
        lyrics: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      };

      // Check if file type is allowed for the selected content type
      if (allowedFileTypes[type] && !allowedFileTypes[type].includes(fileType)) {
        // Delete the uploaded file
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error('Error deleting invalid file:', err);
        }

        // Show error message
        req.flash('error', `Invalid file type for ${type}. Please upload ${type === 'song' ? 'MP3/WAV' : type === 'video' ? 'MP4/MOV' : 'PDF/DOC/DOCX'} files only.`);
        return res.redirect(`/admin/content/${req.params.id}/edit`);
      }
    }

    // Update basic fields
    content.title = title;
    content.description = description;
    content.type = type;
    content.artist = artist;
    content.featured = featured === 'on';

    // Update tags if provided
    if (tags) {
      content.tags = tags.split(',').map(tag => tag.trim());
    }

    // Update release date if provided
    if (releaseDate) {
      content.releaseDate = new Date(releaseDate);
    }

    // Update lyrics if provided and content type is lyrics
    if (type === 'lyrics' && lyrics) {
      content.lyrics = lyrics;
    }

    // Update thumbnail if provided
    if (req.files && req.files.thumbnailFile && req.files.thumbnailFile[0]) {
      const thumbnailPath = getStoragePath('content', req.files.thumbnailFile[0].filename);
      content.thumbnailUrl = thumbnailPath;
    }

    // Update content file if provided
    if (req.files && req.files.contentFile && req.files.contentFile[0]) {
      const contentFilePath = getStoragePath('content', req.files.contentFile[0].filename);
      content.fileUrl = contentFilePath;
    }

    await content.save();

    req.flash('success', 'Content updated successfully');
    res.redirect(`/admin/content/${content._id}/details`);
  } catch (error) {
    console.error('Update content error:', error);
    req.flash('error', 'Failed to update content');
    res.redirect(`/admin/content/${req.params.id}/edit`);
  }
});

// Feature content
router.post('/:id/feature', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);

    if (!content) {
      req.flash('error', 'Content not found');
      return res.redirect('/admin/content');
    }

    // Update featured status
    content.featured = !content.featured;
    await content.save();

    // Redirect back to the referring page
    const referer = req.get('Referer');
    if (referer && referer.includes(`/admin/content/${req.params.id}/details`)) {
      req.flash('success', `Content ${content.featured ? 'featured' : 'unfeatured'} successfully`);
      return res.redirect(`/admin/content/${req.params.id}/details`);
    }

    req.flash('success', `Content ${content.featured ? 'featured' : 'unfeatured'} successfully`);
    res.redirect('/admin/content');
  } catch (error) {
    console.error('Feature content error:', error);
    req.flash('error', 'Failed to update content featured status');
    res.redirect('/admin/content');
  }
});

// Delete content confirmation page
router.get('/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name email' }
      });

    if (!content) {
      req.flash('error', 'Content not found');
      return res.redirect('/admin/content');
    }

    res.render('admin/content-delete', {
      layout: 'admin',
      currentPath: '/admin/content',
      title: 'Delete Content',
      content
    });
  } catch (error) {
    console.error('Delete content page error:', error);
    req.flash('error', 'Failed to load delete page');
    res.redirect('/admin/content');
  }
});

// Delete content
router.post('/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);

    if (!content) {
      req.flash('error', 'Content not found');
      return res.redirect('/admin/content');
    }

    // Delete content
    await Content.findByIdAndDelete(req.params.id);

    req.flash('success', 'Content deleted successfully');
    res.redirect('/admin/content');
  } catch (error) {
    console.error('Delete content error:', error);
    req.flash('error', 'Failed to delete content');
    res.redirect('/admin/content');
  }
});

module.exports = router;
