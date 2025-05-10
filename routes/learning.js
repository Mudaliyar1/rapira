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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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
    const modules = await LearningModule.find()
      .sort({ forArtistLevel: 1, order: 1 })
      .populate('createdBy', 'name');

    res.render('admin/learning-modules', {
      layout: 'admin',
      title: 'Manage Learning Modules',
      currentPath: '/learning/admin',
      modules
    });
  } catch (error) {
    console.error('Error in admin learning modules:', error);
    req.flash('error', 'An error occurred while loading learning modules');
    res.redirect('/admin');
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
router.post('/admin/add', isLoggedIn, isAdmin, upload.single('thumbnailImage'), async (req, res) => {
  try {
    const { title, description, contentType, content, forArtistLevel, order, isRequired } = req.body;

    // Validate input
    if (!title || !description || !contentType || !forArtistLevel) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/learning/admin/add');
    }

    // Validate content based on content type
    if (!content || (Array.isArray(content) && content.every(item => !item))) {
      req.flash('error', 'Please provide content for the learning module');
      return res.redirect('/learning/admin/add');
    }

    // Handle content field (could be an array if both fields are submitted)
    let moduleContent = content;
    if (Array.isArray(content)) {
      // Find the non-empty content value
      moduleContent = content.find(item => item) || '';
    }

    // Create new learning module
    const newModule = new LearningModule({
      title,
      description,
      contentType,
      content: moduleContent,
      forArtistLevel,
      order: order || 0,
      isRequired: isRequired === 'on',
      createdBy: req.session.user.id
    });

    // Set thumbnail if uploaded
    if (req.file) {
      newModule.thumbnailImage = '/uploads/learning/' + req.file.filename;
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
router.post('/admin/edit/:id', isLoggedIn, isAdmin, upload.single('thumbnailImage'), async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.flash('error', 'Invalid module ID');
      return res.redirect('/learning/admin');
    }

    const { title, description, contentType, content, forArtistLevel, order, isRequired } = req.body;

    // Validate input
    if (!title || !description || !contentType || !forArtistLevel) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect(`/learning/admin/edit/${req.params.id}`);
    }

    // Validate content based on content type
    if (!content || (Array.isArray(content) && content.every(item => !item))) {
      req.flash('error', 'Please provide content for the learning module');
      return res.redirect(`/learning/admin/edit/${req.params.id}`);
    }

    const module = await LearningModule.findById(req.params.id);

    if (!module) {
      req.flash('error', 'Learning module not found');
      return res.redirect('/learning/admin');
    }

    // Handle content field (could be an array if both fields are submitted)
    let moduleContent = content;
    if (Array.isArray(content)) {
      // Find the non-empty content value
      moduleContent = content.find(item => item) || '';
    }

    // Update module
    module.title = title;
    module.description = description;
    module.contentType = contentType;
    module.content = moduleContent;
    module.forArtistLevel = forArtistLevel;
    module.order = order || 0;
    module.isRequired = isRequired === 'on';

    // Update thumbnail if uploaded
    if (req.file) {
      // Delete old thumbnail if it's not the default
      if (module.thumbnailImage && module.thumbnailImage !== '/images/default-learning.jpg') {
        const oldImagePath = path.join(__dirname, '../public', module.thumbnailImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Set new thumbnail
      module.thumbnailImage = '/uploads/learning/' + req.file.filename;
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
