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
const mongoose = require('mongoose');
const Media = require('../models/Media');
const { isLoggedIn, isAdmin, hasAdminPermission } = require('../middleware/auth');
const { deleteMedia } = require('../utils/mediaService');
const { uploadFileToCloudinary } = require('../utils/mediaService');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// All routes require admin authentication
router.use(isLoggedIn, hasAdminPermission('manage_media_management'));

// GET /admin/media - List all media with pagination and filters
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const { module, ownerType, search, sortBy = 'createdAt', sortOrder = 'desc', resourceType, ownerSearch } = req.query;

    // Debug logging
    console.log('📊 MEDIA FILTER DEBUG:', {
      module,
      ownerType,
      resourceType,
      search,
      ownerSearch,
      page,
      limit
    });

    let filter = {};

    // Basic filters
    if (module && module !== 'all') filter.module = module;
    if (ownerType && ownerType !== 'all') filter.ownerType = ownerType;
    if (resourceType && resourceType !== 'all') filter.resource_type = resourceType;

    // Handle owner search (email/username)
    if (ownerSearch && ownerSearch.trim()) {
      const User = require('../models/User');
      const Artist = require('../models/Artist');

      try {
        // Trim whitespace from search term
        const trimmedSearch = ownerSearch.trim();
        console.log('🔍 Searching for owner:', trimmedSearch);

        // Search for users by email or username
        const users = await User.find({
          $or: [
            { email: { $regex: trimmedSearch, $options: 'i' } },
            { username: { $regex: trimmedSearch, $options: 'i' } }
          ]
        }).select('_id email username').lean();

        console.log(`   Found ${users.length} users:`, users.map(u => `${u.email}/${u.username}`));

        // Get user IDs
        const userIds = users.map(u => u._id);

        // Search for artists by stageName OR by their linked user ID
        const artistFilter = {
          $or: [
            { stageName: { $regex: trimmedSearch, $options: 'i' } }
          ]
        };

        // If we found users, also include artists that are linked to those users
        if (userIds.length > 0) {
          artistFilter.$or.push({ user: { $in: userIds } });
        }

        const artists = await Artist.find(artistFilter).select('_id user stageName').populate('user', 'email').lean();

        console.log(`   Found ${artists.length} artists:`, artists.map(a => `${a.stageName} (${a.user?.email || 'no email'})`));

        // Combine all owner IDs
        const ownerIds = [
          ...userIds,
          ...artists.map(a => a._id)
        ];

        if (ownerIds.length > 0) {
          filter.ownerId = { $in: ownerIds };
          console.log(`   ✅ Filter set for ${ownerIds.length} owners (${userIds.length} users, ${artists.length} artists)`);
        } else {
          // No matches, show helpful message and return empty result
          filter.ownerId = new mongoose.Types.ObjectId('000000000000000000000000');
          console.log(`   ❌ No users or artists found with email/username: "${trimmedSearch}"`);
          console.log('   💡 Tip: Check spelling or try searching by stage name instead');
          req.flash('warning', `No users or artists found with: "${trimmedSearch}". Check the spelling or try a different search term.`);
        }
      } catch (err) {
        console.error('Error searching for owner:', err);
      }
    }

    // Handle filename/public_id search
    if (search && search.trim()) {
      filter.$or = [
        { original_filename: { $regex: search, $options: 'i' } },
        { public_id: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Debug filter
    console.log('🔎 Final filter:', JSON.stringify(filter, null, 2));

    const mediaList = await Media.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    console.log(`📌 Query found ${mediaList.length} media items`);

    // Populate owner details
    const User = require('../models/User');
    const Artist = require('../models/Artist');
    const Venue = require('../models/Venue');

    const enrichedMediaList = await Promise.all(
      mediaList.map(async (media) => {
        let ownerDetails = null;

        if (media.ownerId && media.ownerType) {
          try {
            if (media.ownerType === 'user') {
              ownerDetails = await User.findById(media.ownerId).select('email username profileImage').lean();
            } else if (media.ownerType === 'artist') {
              ownerDetails = await Artist.findById(media.ownerId).select('email stageName profileImage').lean();
            } else if (media.ownerType === 'venue') {
              ownerDetails = await Venue.findById(media.ownerId).select('email name image').lean();
            }
          } catch (err) {
            console.error('Error populating owner:', err);
          }
        }

        return { ...media, ownerDetails };
      })
    );

    const totalMedia = await Media.countDocuments(filter);
    const totalPages = Math.ceil(totalMedia / limit);

    // Calculate total storage used
    const allMedia = await Media.find(filter).select('bytes resource_type').lean();
    const totalBytes = allMedia.reduce((sum, m) => sum + (m.bytes || 0), 0);
    const totalSize = formatBytes(totalBytes);

    // Get statistics by type
    const stats = {
      images: await Media.countDocuments({ ...filter, resource_type: 'image' }),
      videos: await Media.countDocuments({ ...filter, resource_type: 'video' }),
      audios: await Media.countDocuments({ ...filter, resource_type: 'video', format: { $in: ['mp3', 'wav', 'ogg', 'm4a'] } }),
      raw: await Media.countDocuments({ ...filter, resource_type: 'raw' }),
      totalSize
    };

    // Get all unique module values from database
    const allModules = await Media.distinct('module');
    console.log('📋 Available modules in database:', allModules);

    // Get statistics by module
    const moduleStats = await Media.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$module',
          count: { $sum: 1 },
          totalBytes: { $sum: '$bytes' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.render('admin/media', {
      title: 'Media Management',
      mediaList: enrichedMediaList,
      totalMedia,
      currentPage: page,
      totalPages,
      filters: req.query,
      stats,
      moduleStats,
      layout: 'admin',
      currentPath: '/admin/media',
      messages: {
        success: req.flash('success'),
        error: req.flash('error')
      }
    });
  } catch (error) {
    console.error('Error listing media:', error);
    req.flash('error', 'Failed to load media list');
    res.redirect('/admin');
  }
});

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// GET /admin/media/:id/details - View full details of a media file
router.get('/:id/details', async (req, res) => {
  try {
    const media = await Media.findById(req.params.id).lean();
    if (!media) {
      req.flash('error', 'Media not found');
      return res.redirect('/admin/media');
    }

    // Get owner details
    let ownerDetails = null;
    const User = require('../models/User');
    const Artist = require('../models/Artist');
    const Venue = require('../models/Venue');

    if (media.ownerId && media.ownerType) {
      try {
        if (media.ownerType === 'user') {
          ownerDetails = await User.findById(media.ownerId).select('email username firstName lastName profileImage phone city state bio').lean();
        } else if (media.ownerType === 'artist') {
          const artist = await Artist.findById(media.ownerId).populate('user', 'email').select('stageName firstName lastName profileImage phone city state bio description').lean();
          ownerDetails = artist;
          // Add email from user
          if (artist && artist.user) {
            ownerDetails.email = artist.user.email;
          }
        } else if (media.ownerType === 'venue') {
          ownerDetails = await Venue.findById(media.ownerId).select('email name venueImage phone city state description').lean();
        }
      } catch (err) {
        console.error('Error populating owner:', err);
      }
    }

    res.render('admin/media/details', {
      title: 'Media Details',
      media,
      ownerDetails,
      layout: 'admin',
      currentPath: '/admin/media',
      formatBytes
    });
  } catch (error) {
    console.error('Error fetching media details:', error);
    req.flash('error', 'Failed to load media details');
    res.redirect('/admin/media');
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
