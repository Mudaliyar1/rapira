/**
 * Admin Media Management Routes (UPDATED FOR CLOUDINARY)
 * 
 * Routes for Cloudinary-based media management:
 * - List and view Cloudinary media assets
 * - Delete Cloudinary assets
 * - Migrate local /uploads to Cloudinary
 */

const express = require('express');
const router = express.Router();
const Media = require('../models/Media');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { deleteMedia } = require('../utils/mediaService');
const { uploadFileToCloudinary } = require('../utils/mediaService');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// All routes require admin authentication
router.use(isLoggedIn, isAdmin);

// GET /admin/media - List all media with pagination and filters
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const { module, ownerType, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    let filter = {};
    if (module && module !== 'all') filter.module = module;
    if (ownerType && ownerType !== 'all') filter.ownerType = ownerType;
    if (search) {
      filter.$or = [
        { original_filename: { $regex: search, $options: 'i' } },
        { public_id: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    const mediaList = await Media.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalMedia = await Media.countDocuments(filter);
    const totalPages = Math.ceil(totalMedia / limit);

    res.render('admin/media', {
      title: 'Cloudinary Media Management',
      mediaList,
      totalMedia,
      currentPage: page,
      totalPages,
      filters: req.query,
      layout: 'admin',
      currentPath: '/admin/media'
    });
  } catch (error) {
    console.error('Error listing media:', error);
    req.flash('error', 'Failed to load media list');
    res.redirect('/admin');
  }
});

// POST /admin/media/delete/:id - Delete a media item from Cloudinary
router.post('/delete/:id', async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) {
      req.flash('error', 'Media not found');
      return res.redirect('/admin/media');
    }

    await deleteMedia(media);
    req.flash('success', `Media "${media.original_filename}" deleted from Cloudinary`);
    res.redirect('/admin/media');
  } catch (error) {
    console.error('Error deleting media:', error);
    req.flash('error', 'Failed to delete media');
    res.redirect('/admin/media');
  }
});

// POST /admin/media/migrate-local - Migrate local /uploads to Cloudinary
router.post('/migrate-local', async (req, res) => {
  try {
    const uploadsPath = path.join(__dirname, '..', 'public', 'uploads');

    if (!fsSync.existsSync(uploadsPath)) {
      req.flash('info', 'No local uploads directory found');
      return res.redirect('/admin/media');
    }

    let migratedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    async function scanAndMigrate(dir, relativePrefix = '') {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.join(relativePrefix, entry.name).replace(/\\/g, '/');

          if (entry.isDirectory()) {
            await scanAndMigrate(fullPath, relativePath);
          } else {
            try {
              const existing = await Media.findOne({ original_filename: entry.name });
              if (existing) {
                skippedCount++;
                continue;
              }

              const fileBuffer = await fs.readFile(fullPath);
              const folder = `rapira/legacy/${relativePrefix.split('/')[0] || 'misc'}`;

              await uploadFileToCloudinary(
                {
                  buffer: fileBuffer,
                  originalname: entry.name,
                  mimetype: getMimetype(entry.name)
                },
                {
                  module: 'legacyMigration',
                  ownerType: 'system',
                  folder
                }
              );

              migratedCount++;
              console.log(`✓ Migrated: ${relativePath}`);
            } catch (err) {
              failedCount++;
              console.error(`✗ Failed: ${relativePath}`, err.message);
            }
          }
        }
      } catch (err) {
        console.error(`Error scanning ${dir}:`, err.message);
      }
    }

    console.log('Starting migration...');
    await scanAndMigrate(uploadsPath);

    req.flash('success', `Migration complete: ${migratedCount} migrated, ${failedCount} failed, ${skippedCount} skipped`);
    res.redirect('/admin/media');
  } catch (error) {
    console.error('Migration error:', error);
    req.flash('error', 'Migration failed');
    res.redirect('/admin/media');
  }
});

// Helper
function getMimetype(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

module.exports = router;
