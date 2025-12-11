
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const Content = require('../models/Content');
const Artist = require('../models/Artist');
const Media = require('../models/Media');
const { uploadFileToCloudinary, deleteMedia } = require('../utils/mediaService');
const { getFileUrl } = require('../utils/fileHelper');

// Set up multer for file uploads (memory storage → Cloudinary)
const storage = multer.memoryStorage();

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

    // Upload content file to Cloudinary
    let contentFileUrl;
    let contentFileMediaId;
    try {
      const { media } = await uploadFileToCloudinary(req.files.contentFile[0], {
        module: 'adminContent',
        ownerType: 'admin',
        ownerId: req.session?.user?.id,
        folder: `rapira/admin/content/${artist}`
      });
      contentFileUrl = media.secure_url;
      contentFileMediaId = media._id;
    } catch (err) {
      console.error('Cloud upload failed (content file):', err);
      req.flash('error', 'Content upload failed');
      return res.redirect('/admin/content/add');
    }

    const newContent = new Content({
      title,
      description: description || '',
      type,
      artist,
      featured: featured === 'on',
      fileUrl: contentFileUrl,
      fileMedia: contentFileMediaId
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
      try {
        const { media } = await uploadFileToCloudinary(req.files.thumbnailFile[0], {
          module: 'adminContentThumb',
          ownerType: 'admin',
          ownerId: req.session?.user?.id,
          folder: `rapira/admin/content/${artist}`
        });
        newContent.thumbnailUrl = media.secure_url;
        newContent.thumbnailMedia = media._id;
      } catch (err) {
        console.error('Cloud upload failed (thumbnail):', err);
        req.flash('error', 'Thumbnail upload failed');
        return res.redirect('/admin/content/add');
      }
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
    // Get search parameters
    const { search, type, featured, artist, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    // Type filter
    if (type && type !== 'all') {
      filter.type = type;
    }

    // Featured filter
    if (featured && featured !== 'all') {
      filter.featured = featured === 'true';
    }

    // Artist filter
    if (artist && artist !== 'all') {
      filter.artist = artist;
    }

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));
        filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        filter.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
      } else if (dateRange === 'this-year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        filter.createdAt = { $gte: startOfYear, $lte: endOfYear };
      }
    }

    // Build sort options
    let sortOptions = { createdAt: -1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get content with filters
    let content = await Content.find(filter)
      .sort(sortOptions)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      });

    // Apply text search on populated data
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      content = content.filter(item => {
        const title = (item.title || '').toLowerCase();
        const description = (item.description || '').toLowerCase();
        const artistName = (item.artist && item.artist.user ? item.artist.user.name : '').toLowerCase();
        const stageName = (item.artist ? item.artist.stageName : '').toLowerCase();
        const tags = (item.tags || []).join(' ').toLowerCase();

        return title.includes(searchTerm) ||
               description.includes(searchTerm) ||
               artistName.includes(searchTerm) ||
               stageName.includes(searchTerm) ||
               tags.includes(searchTerm);
      });
    }

    // Get all artists for filter dropdown
    const allArtists = await Artist.find()
      .populate('user', 'name')
      .sort({ 'user.name': 1 });

    // Get statistics
    const totalContent = await Content.countDocuments();
    const musicContent = await Content.countDocuments({ type: 'music' });
    const videoContent = await Content.countDocuments({ type: 'video' });
    const lyricsContent = await Content.countDocuments({ type: 'lyrics' });
    const featuredContent = await Content.countDocuments({ featured: true });

    res.render('admin/content', {
      layout: 'admin',
      currentPath: '/admin/content',
      title: 'Manage Content',
      content,
      searchParams: {
        search: search || '',
        type: type || 'all',
        featured: featured || 'all',
        artist: artist || 'all',
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
      },
      artists: allArtists
    });
  } catch (error) {
    console.error('Manage content error:', error);
    req.flash('error', 'Failed to load content');
    res.redirect('/admin');
  }
});

// Export content to CSV
router.get('/export', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters (same as main route)
    const { search, type, featured, artist, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    if (type && type !== 'all') {
      filter.type = type;
    }

    if (featured && featured !== 'all') {
      filter.featured = featured === 'true';
    }

    if (artist && artist !== 'all') {
      filter.artist = artist;
    }

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));
        filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        filter.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
      } else if (dateRange === 'this-year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        filter.createdAt = { $gte: startOfYear, $lte: endOfYear };
      }
    }

    // Build sort options
    let sortOptions = { createdAt: -1 };
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get content with filters
    let content = await Content.find(filter)
      .sort(sortOptions)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      });

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      content = content.filter(item => {
        const title = (item.title || '').toLowerCase();
        const description = (item.description || '').toLowerCase();
        const artistName = (item.artist && item.artist.user ? item.artist.user.name : '').toLowerCase();
        const stageName = (item.artist ? item.artist.stageName : '').toLowerCase();
        const tags = (item.tags || []).join(' ').toLowerCase();

        return title.includes(searchTerm) ||
               description.includes(searchTerm) ||
               artistName.includes(searchTerm) ||
               stageName.includes(searchTerm) ||
               tags.includes(searchTerm);
      });
    }

    // Generate CSV content
    const csvHeader = 'Title,Type,Artist,Featured,Tags,Release Date,Created Date,Description\n';
    const csvRows = content.map(item => {
      const title = `"${(item.title || '').replace(/"/g, '""')}"`;
      const type = item.type || '';
      const artistName = item.artist && item.artist.user ? item.artist.user.name : '';
      const artist = `"${artistName.replace(/"/g, '""')}"`;
      const featured = item.featured ? 'Yes' : 'No';
      const tags = `"${(item.tags || []).join(', ').replace(/"/g, '""')}"`;
      const releaseDate = item.releaseDate ? new Date(item.releaseDate).toLocaleDateString() : '';
      const createdDate = new Date(item.createdAt).toLocaleDateString();
      const description = `"${(item.description || '').replace(/"/g, '""')}"`;

      return `${title},${type},${artist},${featured},${tags},${releaseDate},${createdDate},${description}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `content_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export content error:', error);
    req.flash('error', 'Failed to export content');
    res.redirect('/admin/content');
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
      try {
        // Delete old thumbnail media if exists
        if (content.thumbnailMedia) {
          const oldMedia = await Media.findById(content.thumbnailMedia);
          if (oldMedia) {
            await deleteMedia(oldMedia);
          }
        }
        // Upload new thumbnail
        const { media } = await uploadFileToCloudinary(req.files.thumbnailFile[0], {
          module: 'adminContentThumb',
          ownerType: 'admin',
          ownerId: req.session?.user?.id,
          folder: `rapira/admin/content/${content.artist}`
        });
        content.thumbnailUrl = media.secure_url;
        content.thumbnailMedia = media._id;
      } catch (err) {
        console.error('Thumbnail update error:', err);
        req.flash('warning', 'Failed to update thumbnail');
      }
    }

    // Update content file if provided
    if (req.files && req.files.contentFile && req.files.contentFile[0]) {
      try {
        // Delete old content media if exists
        if (content.fileMedia) {
          const oldMedia = await Media.findById(content.fileMedia);
          if (oldMedia) {
            await deleteMedia(oldMedia);
          }
        }
        // Upload new content file
        const { media } = await uploadFileToCloudinary(req.files.contentFile[0], {
          module: 'adminContent',
          ownerType: 'admin',
          ownerId: req.session?.user?.id,
          folder: `rapira/admin/content/${content.artist}`
        });
        content.fileUrl = media.secure_url;
        content.fileMedia = media._id;
      } catch (err) {
        console.error('Content file update error:', err);
        req.flash('warning', 'Failed to update content file');
      }
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
