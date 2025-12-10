/**
 * Admin Media Management Routes
 * 
 * NEW: Routes for MongoDB-based media backup & restore system
 * 
 * Provides:
 * - Dashboard with media statistics and list
 * - Scan and backup functionality
 * - Restore from MongoDB functionality
 * - Download media metadata
 */

const express = require('express');
const router = express.Router();
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const adminMediaController = require('../controllers/adminMediaController');

// All routes require admin authentication
router.use(isLoggedIn, isAdmin);

// GET - Media management dashboard
router.get('/', adminMediaController.getMediaDashboard);

// GET - View/download specific media
router.get('/:id/view', adminMediaController.viewMedia);

// POST - Scan /uploads and backup to MongoDB
router.post('/backup-now', adminMediaController.backupNow);

// POST - Restore all media from MongoDB to /uploads
router.post('/restore-all', adminMediaController.restoreAll);

// POST - Delete a media backup (soft delete)
router.post('/:id/delete', adminMediaController.deleteMedia);

// GET - Download media metadata as JSON
router.get('/download-info', adminMediaController.downloadMediaInfo);

module.exports = router;
