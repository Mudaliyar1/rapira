const express = require('express');
const router = express.Router();
const LearningModule = require('../models/LearningModule');
const LearningProgress = require('../models/LearningProgress');
const Artist = require('../models/Artist');
const User = require('../models/User');
const ArtistUpgradeRequest = require('../models/ArtistUpgradeRequest');
const { isLoggedIn, isAdmin, isArtist } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/uploads/learning');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'learning-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit for richer content
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|pdf|mp4|webm/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image, PDF, and video files are allowed'));
    }
  }
});

// User: Learning modules page
router.get('/', isLoggedIn, async (req, res) => {
  try {
    // Check if user is an artist
    let artist = null;
    let artistLevel = 'Beginner';
    let pendingUpgradeRequest = null;

    if (req.session.user.role === 'artist') {
      artist = await Artist.findOne({ user: req.session.user.id });

      if (artist) {
        artistLevel = artist.artistLevel;

        // Check if there's a pending upgrade request
        pendingUpgradeRequest = await ArtistUpgradeRequest.findOne({
          artist: artist._id,
          status: 'pending'
        }).populate('user');
      }
    }

    // Get learning modules for the user's level or all levels
    const modules = await LearningModule.find({
      $or: [
        { forArtistLevel: artistLevel },
        { forArtistLevel: 'All' }
      ]
    }).sort({ order: 1 });

    // Get user's progress
    const progress = await LearningProgress.find({ user: req.session.user.id });

    // Create a map of completed modules for easier access
    const completedModules = {};

    progress.forEach(p => {
      completedModules[p.module.toString()] = p.completed;
    });

    res.render('learning/index', {
      title: 'Learning Modules',
      modules,
      completedModules,
      artist,
      artistLevel,
      pendingUpgradeRequest
    });
  } catch (error) {
    console.error('Error in learning modules page:', error);
    req.flash('error', 'An error occurred while loading learning modules');
    res.redirect('/');
  }
});

// User: View learning module
router.get('/module/:id', isLoggedIn, async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.flash('error', 'Invalid module ID');
      return res.redirect('/learning');
    }

    const module = await LearningModule.findById(req.params.id);

    if (!module) {
      req.flash('error', 'Learning module not found');
      return res.redirect('/learning');
    }

    // Check if user is an artist
    let artist = null;
    let artistLevel = 'Beginner';

    if (req.session.user.role === 'artist') {
      artist = await Artist.findOne({ user: req.session.user.id });

      if (artist) {
        artistLevel = artist.artistLevel;
      }
    }

    // Check if module is available for the user's level
    if (module.forArtistLevel !== 'All' && module.forArtistLevel !== artistLevel) {
      req.flash('error', 'This learning module is not available for your artist level');
      return res.redirect('/learning');
    }

    // Get user's progress for this module
    let progress = await LearningProgress.findOne({
      user: req.session.user.id,
      module: module._id
    });

    // If no progress record exists, create one
    if (!progress) {
      progress = new LearningProgress({
        user: req.session.user.id,
        module: module._id,
        completed: false
      });

      await progress.save();
    }

    res.render('learning/module', {
      title: module.title,
      module,
      progress,
      artist,
      artistLevel
    });
  } catch (error) {
    console.error('Error in view learning module:', error);
    req.flash('error', 'An error occurred while loading the learning module');
    res.redirect('/learning');
  }
});

// User: Mark module as completed
router.post('/module/:id/complete', isLoggedIn, async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.flash('error', 'Invalid module ID');
      return res.redirect('/learning');
    }

    const module = await LearningModule.findById(req.params.id);

    if (!module) {
      req.flash('error', 'Learning module not found');
      return res.redirect('/learning');
    }

    // Get user's progress for this module
    let progress = await LearningProgress.findOne({
      user: req.session.user.id,
      module: module._id
    });

    // If no progress record exists, create one
    if (!progress) {
      progress = new LearningProgress({
        user: req.session.user.id,
        module: module._id,
        completed: true,
        completedAt: new Date()
      });
    } else {
      // Update existing progress
      progress.completed = true;
      progress.completedAt = new Date();
    }

    await progress.save();

    // Check if all required modules are completed for Beginner and Intermediate artists
    if (req.session.user.role === 'artist') {
      const artist = await Artist.findOne({ user: req.session.user.id });

      if (artist && (artist.artistLevel === 'Beginner' || artist.artistLevel === 'Intermediate')) {
        // Get all required modules for the artist's level
        const requiredModules = await LearningModule.find({
          forArtistLevel: artist.artistLevel,
          isRequired: true
        });

        // Get user's progress for all modules
        const userProgress = await LearningProgress.find({
          user: req.session.user.id,
          completed: true
        });

        // Check if all required modules are completed
        const completedModuleIds = userProgress.map(p => p.module.toString());
        const allCompleted = requiredModules.every(m => completedModuleIds.includes(m._id.toString()));

        if (allCompleted) {
          // Update artist's completedLearning status
          artist.completedLearning = true;
          await artist.save();
        }
      }
    }

    req.flash('success', 'Module marked as completed');
    res.redirect('/learning');
  } catch (error) {
    console.error('Error in complete learning module:', error);
    req.flash('error', 'An error occurred while marking the module as completed');
    res.redirect('/learning');
  }
});

// This route has been replaced with the artist upgrade request system

// Admin: Manage learning modules
router.get('/admin', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters
    const { search, contentType, forArtistLevel, isRequired, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    // Content type filter
    if (contentType && contentType !== 'all') {
      filter.contentType = contentType;
    }

    // Artist level filter
    if (forArtistLevel && forArtistLevel !== 'all') {
      filter.forArtistLevel = forArtistLevel;
    }

    // Required filter
    if (isRequired && isRequired !== 'all') {
      filter.isRequired = isRequired === 'true';
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
    let sortOptions = { forArtistLevel: 1, order: 1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get modules with filters
    let modules = await LearningModule.find(filter)
      .sort(sortOptions)
      .populate('createdBy', 'name');

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      modules = modules.filter(module => {
        const title = (module.title || '').toLowerCase();
        const description = (module.description || '').toLowerCase();
        const content = (module.content || '').toLowerCase();
        const createdBy = (module.createdBy ? module.createdBy.name : '').toLowerCase();

        return title.includes(searchTerm) ||
               description.includes(searchTerm) ||
               content.includes(searchTerm) ||
               createdBy.includes(searchTerm);
      });
    }

    // Get statistics
    const totalModules = await LearningModule.countDocuments();
    const textModules = await LearningModule.countDocuments({ contentType: 'text' });
    const videoModules = await LearningModule.countDocuments({ contentType: 'video' });
    const requiredModules = await LearningModule.countDocuments({ isRequired: true });
    const beginnerModules = await LearningModule.countDocuments({ forArtistLevel: 'Beginner' });
    const intermediateModules = await LearningModule.countDocuments({ forArtistLevel: 'Intermediate' });
    const advancedModules = await LearningModule.countDocuments({ forArtistLevel: 'Advanced' });

    res.render('admin/learning-modules', {
      layout: 'admin',
      title: 'Manage Learning Modules',
      currentPath: '/learning/admin',
      modules,
      searchParams: {
        search: search || '',
        contentType: contentType || 'all',
        forArtistLevel: forArtistLevel || 'all',
        isRequired: isRequired || 'all',
        dateRange: dateRange || 'all',
        sortBy: sortBy || 'forArtistLevel',
        sortOrder: sortOrder || 'asc'
      },
      stats: {
        total: totalModules,
        text: textModules,
        video: videoModules,
        required: requiredModules,
        beginner: beginnerModules,
        intermediate: intermediateModules,
        advanced: advancedModules,
        filtered: modules.length
      }
    });
  } catch (error) {
    console.error('Error in admin learning modules:', error);
    req.flash('error', 'An error occurred while loading learning modules');
    res.redirect('/admin');
  }
});

// Export learning modules to CSV
router.get('/admin/export', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters (same as main route)
    const { search, contentType, forArtistLevel, isRequired, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    if (contentType && contentType !== 'all') {
      filter.contentType = contentType;
    }

    if (forArtistLevel && forArtistLevel !== 'all') {
      filter.forArtistLevel = forArtistLevel;
    }

    if (isRequired && isRequired !== 'all') {
      filter.isRequired = isRequired === 'true';
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
    let sortOptions = { forArtistLevel: 1, order: 1 };
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get modules with filters
    let modules = await LearningModule.find(filter)
      .sort(sortOptions)
      .populate('createdBy', 'name');

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      modules = modules.filter(module => {
        const title = (module.title || '').toLowerCase();
        const description = (module.description || '').toLowerCase();
        const content = (module.content || '').toLowerCase();
        const createdBy = (module.createdBy ? module.createdBy.name : '').toLowerCase();

        return title.includes(searchTerm) ||
               description.includes(searchTerm) ||
               content.includes(searchTerm) ||
               createdBy.includes(searchTerm);
      });
    }

    // Generate CSV content
    const csvHeader = 'Title,Content Type,Artist Level,Order,Required,Created By,Created Date,Description\n';
    const csvRows = modules.map(module => {
      const title = `"${(module.title || '').replace(/"/g, '""')}"`;
      const contentType = module.contentType || '';
      const artistLevel = module.forArtistLevel || '';
      const order = module.order || 0;
      const required = module.isRequired ? 'Yes' : 'No';
      const createdBy = module.createdBy ? module.createdBy.name : '';
      const createdDate = new Date(module.createdAt).toLocaleDateString();
      const description = `"${(module.description || '').replace(/"/g, '""')}"`;

      return `${title},${contentType},${artistLevel},${order},${required},"${createdBy}",${createdDate},${description}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `learning_modules_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export learning modules error:', error);
    req.flash('error', 'Failed to export learning modules');
    res.redirect('/learning/admin');
  }
});

// Admin: Add learning module form
router.get('/admin/add', isLoggedIn, isAdmin, (req, res) => {
  res.render('admin/add-learning-module', {
    layout: 'admin',
    title: 'Add Learning Module',
    currentPath: '/learning/admin'
  });
});

// Admin: Add learning module process
router.post('/admin/add', isLoggedIn, isAdmin, upload.fields([
  { name: 'thumbnailImage', maxCount: 1 },
  { name: 'videoFile', maxCount: 5 },
  { name: 'pdfFile', maxCount: 5 },
  { name: 'imageFile', maxCount: 5 }
]), async (req, res) => {
  try {
    const { title, description, forArtistLevel, order, isRequired } = req.body;
    const { textContent, videoUrl, pdfUrl, imageUrl, externalLink } = req.body;

    // Validate required fields
    if (!title || !description || !forArtistLevel) {
      req.flash('error', 'Please fill in all required fields (title, description, artist level)');
      return res.redirect('/learning/admin/add');
    }

    // Collect all content items (support multiple content types)
    const contentItems = [];

    // Check video files (can be multiple)
    if (req.files && req.files.videoFile && req.files.videoFile.length > 0) {
      req.files.videoFile.forEach(file => {
        contentItems.push({
          type: 'video',
          content: '/uploads/learning/' + file.filename
        });
      });
    }
    
    // Check video URL
    if (videoUrl && videoUrl.trim()) {
      contentItems.push({
        type: 'video',
        content: videoUrl.trim()
      });
    }

    // Check PDF files (can be multiple)
    if (req.files && req.files.pdfFile && req.files.pdfFile.length > 0) {
      req.files.pdfFile.forEach(file => {
        contentItems.push({
          type: 'pdf',
          content: '/uploads/learning/' + file.filename
        });
      });
    }
    
    // Check PDF URL
    if (pdfUrl && pdfUrl.trim()) {
      contentItems.push({
        type: 'pdf',
        content: pdfUrl.trim()
      });
    }

    // Check image files (can be multiple)
    if (req.files && req.files.imageFile && req.files.imageFile.length > 0) {
      req.files.imageFile.forEach(file => {
        contentItems.push({
          type: 'image',
          content: '/uploads/learning/' + file.filename
        });
      });
    }
    
    // Check image URL
    if (imageUrl && imageUrl.trim()) {
      contentItems.push({
        type: 'image',
        content: imageUrl.trim()
      });
    }

    // Check external link
    if (externalLink && externalLink.trim()) {
      contentItems.push({
        type: 'link',
        content: externalLink.trim()
      });
    }

    // Check text content
    if (textContent && textContent.trim()) {
      contentItems.push({
        type: 'text',
        content: textContent.trim()
      });
    }

    // Validate at least one content item was provided
    if (contentItems.length === 0) {
      req.flash('error', 'Please provide content in at least one format (text, URL, or file upload)');
      return res.redirect('/learning/admin/add');
    }

    // Create new learning module with multiple content items
    const newModule = new LearningModule({
      title,
      description,
      contentItems, // Store all content items
      contentType: contentItems[0].type, // Set primary type as first item
      content: contentItems[0].content, // Set primary content as first item
      forArtistLevel,
      order: order || 0,
      isRequired: isRequired === 'on',
      createdBy: req.session.user.id
    });

    // Set thumbnail if uploaded
    if (req.files && req.files.thumbnailImage && req.files.thumbnailImage[0]) {
      newModule.thumbnailImage = '/uploads/learning/' + req.files.thumbnailImage[0].filename;
    }

    await newModule.save();

    req.flash('success', 'Learning module added successfully');
    res.redirect('/learning/admin');
  } catch (error) {
    console.error('Error in add learning module:', error);
    req.flash('error', 'An error occurred while adding the learning module: ' + error.message);
    res.redirect('/learning/admin/add');
  }
});

// Admin: Edit learning module form
router.get('/admin/edit/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.flash('error', 'Invalid module ID');
      return res.redirect('/learning/admin');
    }

    const module = await LearningModule.findById(req.params.id);

    if (!module) {
      req.flash('error', 'Learning module not found');
      return res.redirect('/learning/admin');
    }

    res.render('admin/edit-learning-module', {
      layout: 'admin',
      title: 'Edit Learning Module',
      currentPath: '/learning/admin',
      module
    });
  } catch (error) {
    console.error('Error in edit learning module form:', error);
    req.flash('error', 'An error occurred while loading the learning module');
    res.redirect('/learning/admin');
  }
});

// Admin: Edit learning module process
router.post('/admin/edit/:id', isLoggedIn, isAdmin, upload.fields([
  { name: 'thumbnailImage', maxCount: 1 },
  { name: 'videoFile', maxCount: 5 },
  { name: 'pdfFile', maxCount: 5 },
  { name: 'imageFile', maxCount: 5 }
]), async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.flash('error', 'Invalid module ID');
      return res.redirect('/learning/admin');
    }

    const { title, description, forArtistLevel, order, isRequired } = req.body;
    const { textContent, videoUrl, pdfUrl, imageUrl, externalLink } = req.body;

    // Validate input
    if (!title || !description || !forArtistLevel) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect(`/learning/admin/edit/${req.params.id}`);
    }

    const module = await LearningModule.findById(req.params.id);

    if (!module) {
      req.flash('error', 'Learning module not found');
      return res.redirect('/learning/admin');
    }

    // Collect all NEW content items (replace old items)
    const contentItems = [];

    // Check video files (can be multiple)
    if (req.files && req.files.videoFile && req.files.videoFile.length > 0) {
      req.files.videoFile.forEach(file => {
        contentItems.push({
          type: 'video',
          content: '/uploads/learning/' + file.filename
        });
      });
    }
    
    // Check video URL
    if (videoUrl && videoUrl.trim()) {
      contentItems.push({
        type: 'video',
        content: videoUrl.trim()
      });
    }

    // Check PDF files (can be multiple)
    if (req.files && req.files.pdfFile && req.files.pdfFile.length > 0) {
      req.files.pdfFile.forEach(file => {
        contentItems.push({
          type: 'pdf',
          content: '/uploads/learning/' + file.filename
        });
      });
    }
    
    // Check PDF URL
    if (pdfUrl && pdfUrl.trim()) {
      contentItems.push({
        type: 'pdf',
        content: pdfUrl.trim()
      });
    }

    // Check image files (can be multiple)
    if (req.files && req.files.imageFile && req.files.imageFile.length > 0) {
      req.files.imageFile.forEach(file => {
        contentItems.push({
          type: 'image',
          content: '/uploads/learning/' + file.filename
        });
      });
    }
    
    // Check image URL
    if (imageUrl && imageUrl.trim()) {
      contentItems.push({
        type: 'image',
        content: imageUrl.trim()
      });
    }

    // Check external link
    if (externalLink && externalLink.trim()) {
      contentItems.push({
        type: 'link',
        content: externalLink.trim()
      });
    }

    // Check text content
    if (textContent && textContent.trim()) {
      contentItems.push({
        type: 'text',
        content: textContent.trim()
      });
    }

    // If no new content provided, keep existing content items
    if (contentItems.length === 0) {
      if (!module.contentItems || module.contentItems.length === 0) {
        req.flash('error', 'Please provide content in at least one format (text, URL, or file upload)');
        return res.redirect(`/learning/admin/edit/${req.params.id}`);
      }
      // Keep existing contentItems, but remove deleted items
    } else {
      // Update with new content items
      module.contentItems = contentItems;
      module.contentType = contentItems[0].type; // Set primary type as first item
      module.content = contentItems[0].content; // Set primary content as first item
    }

    // Handle deletion of specific content items
    const itemsToDelete = req.body.itemsToDelete;
    if (itemsToDelete && itemsToDelete.trim()) {
      const indicesToDelete = itemsToDelete.split(',').map(i => parseInt(i)).sort((a, b) => b - a);
      indicesToDelete.forEach(index => {
        if (index >= 0 && index < module.contentItems.length) {
          module.contentItems.splice(index, 1);
        }
      });
      
      // Validate we still have content
      if (module.contentItems.length === 0) {
        req.flash('error', 'Cannot delete all content items. Module must have at least one content item.');
        return res.redirect(`/learning/admin/edit/${req.params.id}`);
      }
      
      // Update primary content if needed
      module.contentType = module.contentItems[0].type;
      module.content = module.contentItems[0].content;
    }

    // Update module
    module.title = title;
    module.description = description;
    module.forArtistLevel = forArtistLevel;
    module.order = order || 0;
    module.isRequired = isRequired === 'on';

    // Update thumbnail if uploaded
    if (req.files && req.files.thumbnailImage && req.files.thumbnailImage[0]) {
      if (module.thumbnailImage && module.thumbnailImage !== '/images/default-learning.jpg') {
        const oldImagePath = path.join(__dirname, '../public', module.thumbnailImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      module.thumbnailImage = '/uploads/learning/' + req.files.thumbnailImage[0].filename;
    }

    await module.save();

    req.flash('success', 'Learning module updated successfully');
    res.redirect('/learning/admin');
  } catch (error) {
    console.error('Error in edit learning module:', error);
    req.flash('error', 'An error occurred while updating the learning module');
    res.redirect('/learning/admin');
  }
});

// Admin: Confirm delete learning module page
router.get('/admin/confirm-delete/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.flash('error', 'Invalid module ID');
      return res.redirect('/learning/admin');
    }

    const module = await LearningModule.findById(req.params.id);

    if (!module) {
      req.flash('error', 'Learning module not found');
      return res.redirect('/learning/admin');
    }

    // Get progress count for this module
    const progressCount = await LearningProgress.countDocuments({ module: module._id });

    res.render('admin/confirm-delete-module', {
      layout: 'admin',
      title: 'Confirm Delete Learning Module',
      currentPath: '/learning/admin',
      module,
      progressCount
    });
  } catch (error) {
    console.error('Error in confirm delete learning module:', error);
    req.flash('error', 'An error occurred while loading the confirmation page');
    res.redirect('/learning/admin');
  }
});

// Admin: Delete learning module
router.post('/admin/delete/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.flash('error', 'Invalid module ID');
      return res.redirect('/learning/admin');
    }

    const module = await LearningModule.findById(req.params.id);

    if (!module) {
      req.flash('error', 'Learning module not found');
      return res.redirect('/learning/admin');
    }

    // Delete thumbnail if it's not the default
    if (module.thumbnailImage && module.thumbnailImage !== '/images/default-learning.jpg') {
      const imagePath = path.join(__dirname, '../public', module.thumbnailImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete progress records for this module
    await LearningProgress.deleteMany({ module: module._id });

    // Delete module
    await LearningModule.findByIdAndDelete(req.params.id);

    req.flash('success', 'Learning module deleted successfully');
    res.redirect('/learning/admin');
  } catch (error) {
    console.error('Error in delete learning module:', error);
    req.flash('error', 'An error occurred while deleting the learning module');
    res.redirect('/learning/admin');
  }
});

// Admin: Confirm delete content item page
router.get('/admin/:id/confirm-delete-content/:itemIndex', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.flash('error', 'Invalid module ID');
      return res.redirect('/learning/admin');
    }

    const module = await LearningModule.findById(req.params.id);
    if (!module) {
      req.flash('error', 'Learning module not found');
      return res.redirect('/learning/admin');
    }

    const itemIndex = parseInt(req.params.itemIndex);
    if (itemIndex < 0 || !module.contentItems || itemIndex >= module.contentItems.length) {
      req.flash('error', 'Content item not found');
      return res.redirect(`/learning/admin/edit/${req.params.id}`);
    }

    const contentItem = module.contentItems[itemIndex];

    res.render('admin/confirm-delete-content-item', {
      layout: 'admin',
      title: 'Confirm Delete Content Item',
      currentPath: '/learning/admin',
      module,
      contentItem,
      contentItemIndex: itemIndex
    });
  } catch (error) {
    console.error('Error loading content item delete confirmation:', error);
    req.flash('error', 'An error occurred');
    res.redirect('/learning/admin');
  }
});

// Admin: Delete content item
router.post('/admin/:id/delete-content-item/:itemIndex', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.flash('error', 'Invalid module ID');
      return res.redirect('/learning/admin');
    }

    const module = await LearningModule.findById(req.params.id);
    if (!module) {
      req.flash('error', 'Learning module not found');
      return res.redirect('/learning/admin');
    }

    const itemIndex = parseInt(req.params.itemIndex);
    if (itemIndex < 0 || !module.contentItems || itemIndex >= module.contentItems.length) {
      req.flash('error', 'Content item not found');
      return res.redirect(`/learning/admin/edit/${req.params.id}`);
    }

    // Get the item being deleted (for logging/display)
    const deletedItem = module.contentItems[itemIndex];
    const contentTypeLabel = deletedItem.type.charAt(0).toUpperCase() + deletedItem.type.slice(1);

    // Check if this would be the last item
    if (module.contentItems.length <= 1) {
      req.flash('error', 'Cannot delete the only content item. A module must have at least one content item.');
      return res.redirect(`/learning/admin/edit/${req.params.id}`);
    }

    // Delete the item
    module.contentItems.splice(itemIndex, 1);

    // Update primary content if needed
    if (module.contentItems.length > 0) {
      module.contentType = module.contentItems[0].type;
      module.content = module.contentItems[0].content;
    }

    await module.save();

    req.flash('success', `${contentTypeLabel} content item deleted successfully`);
    res.redirect(`/learning/admin/edit/${req.params.id}`);
  } catch (error) {
    console.error('Error deleting content item:', error);
    req.flash('error', 'An error occurred while deleting the content item');
    res.redirect(`/learning/admin/edit/${req.params.id}`);
  }
});

// Admin: View user progress
router.get('/admin/progress', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get all artists
    const artists = await Artist.find()
      .populate('user', 'name email');

    // Get all learning modules
    const modules = await LearningModule.find().sort({ forArtistLevel: 1, order: 1 });

    // Get all progress records
    const progress = await LearningProgress.find()
      .populate('user', 'name email')
      .populate('module', 'title');

    // Create a map of user progress for easier access
    const userProgressMap = {};

    // Filter out progress records with null or undefined user or module
    const validProgress = progress.filter(p => p.user && p.module);

    validProgress.forEach(p => {
      if (!userProgressMap[p.user._id]) {
        userProgressMap[p.user._id] = {};
      }

      userProgressMap[p.user._id][p.module._id] = p.completed;
    });

    // Log any invalid progress records for debugging
    const invalidProgress = progress.filter(p => !p.user || !p.module);
    if (invalidProgress.length > 0) {
      console.log(`Found ${invalidProgress.length} invalid progress records:`);
      invalidProgress.forEach((p, i) => {
        console.log(`Record ${i+1}: User: ${p.user ? p.user._id : 'null'}, Module: ${p.module ? p.module._id : 'null'}`);
      });

      // Clean up invalid records
      try {
        for (const invalidRecord of invalidProgress) {
          await LearningProgress.findByIdAndDelete(invalidRecord._id);
          console.log(`Deleted invalid progress record: ${invalidRecord._id}`);
        }
        console.log('Cleanup of invalid progress records completed');
      } catch (cleanupError) {
        console.error('Error cleaning up invalid progress records:', cleanupError);
      }
    }

    res.render('admin/learning-progress', {
      layout: 'admin',
      title: 'User Learning Progress',
      currentPath: '/learning/admin/progress',
      artists,
      modules,
      userProgressMap
    });
  } catch (error) {
    console.error('Error in admin learning progress:', error);
    req.flash('error', 'An error occurred while loading user progress');
    res.redirect('/learning/admin');
  }
});

// Catch-all route for invalid module paths
router.get('/module/*', isLoggedIn, (req, res) => {
  req.flash('error', 'Invalid learning module');
  return res.redirect('/learning');
});

module.exports = router;
