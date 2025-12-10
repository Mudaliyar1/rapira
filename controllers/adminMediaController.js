/**
 * Admin Media Management Controller
 * 
 * Handles media backup management, restore operations, and stats display
 * for the admin dashboard
 */

const MediaBackup = require('../models/MediaBackup');
const {
  scanAndBackupUploadsFolder,
  restoreAllMediaFromMongo,
  getMediaStats,
  formatBytes
} = require('../utils/mediaBackupService');

/**
 * GET /admin/media - Display media management dashboard
 */
exports.getMediaDashboard = async (req, res) => {
  try {
    // Get stats
    const stats = await getMediaStats();

    // Get paginated media list
    const page = parseInt(req.query.page) || 1;
    const perPage = 20;
    const skip = (page - 1) * perPage;

    // Get filter parameters
    const filters = {};
    if (req.query.module) filters.module = req.query.module;
    if (req.query.fileType) filters.fileType = req.query.fileType;
    if (req.query.ownerType) filters.ownerType = req.query.ownerType;
    filters.isDeleted = false;

    // Get total count for pagination
    const totalCount = await MediaBackup.countDocuments(filters);
    const totalPages = Math.ceil(totalCount / perPage);

    // Get media list for current page
    const mediaList = await MediaBackup.find(filters)
      .sort({ uploadedOn: -1 })
      .skip(skip)
      .limit(perPage)
      .lean();

    // Format file sizes
    const formattedMedia = mediaList.map(item => ({
      ...item,
      formattedSize: formatBytes(item.size),
      uploadedOnFormatted: new Date(item.uploadedOn).toLocaleString(),
      lastRestoredOnFormatted: item.lastRestoredOn ? new Date(item.lastRestoredOn).toLocaleString() : 'Never'
    }));

    // Format total size
    const formattedTotalSize = formatBytes(stats.totalSizeBytes);

    res.render('admin/media-management', {
      title: 'Media Management',
      currentPath: '/admin/media',
      stats,
      formattedTotalSize,
      mediaList: formattedMedia,
      currentPage: page,
      totalPages,
      totalCount,
      perPage,
      filters: req.query,
      modules: [
        'artistContent',
        'venueMedia',
        'adminMedia',
        'userProfile',
        'learningModule',
        'merchandise',
        'order',
        'productReview',
        'teamUpdate',
        'other'
      ],
      fileTypes: ['image', 'video', 'audio', 'pdf', 'document', 'other'],
      ownerTypes: ['artist', 'venue', 'admin', 'user', 'system']
    });
  } catch (error) {
    console.error('Error loading media dashboard:', error);
    req.flash('error', 'Failed to load media management');
    res.redirect('/admin');
  }
};

/**
 * POST /admin/media/backup-now - Scan /uploads and backup to MongoDB
 */
exports.backupNow = async (req, res) => {
  try {
    console.log('🔄 Admin triggered backup scan...');

    const result = await scanAndBackupUploadsFolder();

    req.flash('success',
      `Backup complete! Backed up: ${result.backedUp}, Already in MongoDB: ${result.skipped}, Scanned: ${result.scanned}`
    );

    res.redirect('/admin/media');
  } catch (error) {
    console.error('Error during backup scan:', error);
    req.flash('error', 'Backup scan failed. Please check logs.');
    res.redirect('/admin/media');
  }
};

/**
 * POST /admin/media/restore-all - Restore all media from MongoDB to /uploads
 */
exports.restoreAll = async (req, res) => {
  try {
    console.log('🔄 Admin triggered full restore...');

    const result = await restoreAllMediaFromMongo();

    req.flash('success',
      `Restore complete! Restored: ${result.restored}, Errors: ${result.errors}, Total: ${result.total}`
    );

    res.redirect('/admin/media');
  } catch (error) {
    console.error('Error during restore:', error);
    req.flash('error', 'Restore operation failed. Please check logs.');
    res.redirect('/admin/media');
  }
};

/**
 * POST /admin/media/:id/delete - Soft delete a media backup
 */
exports.deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;

    const media = await MediaBackup.findByIdAndUpdate(id, { isDeleted: true }, { new: true });

    if (!media) {
      req.flash('error', 'Media not found');
      return res.redirect('/admin/media');
    }

    req.flash('success', `Deleted: ${media.fileName}`);
    res.redirect('/admin/media');
  } catch (error) {
    console.error('Error deleting media:', error);
    req.flash('error', 'Failed to delete media');
    res.redirect('/admin/media');
  }
};

/**
 * GET /admin/media/:id/view - View or download a specific media file
 */
exports.viewMedia = async (req, res) => {
  try {
    const { id } = req.params;

    // Find media in MongoDB
    const media = await MediaBackup.findById(id);

    if (!media || media.isDeleted) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Set response headers for file display/download
    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('Content-Length', media.data.length);
    res.setHeader('Content-Disposition', `inline; filename="${media.fileName}"`);

    // Send the binary data
    res.send(media.data);

    console.log(`✓ Media viewed: ${media.fileName}`);
  } catch (error) {
    console.error('Error viewing media:', error);
    res.status(500).json({ error: 'Failed to retrieve media' });
  }
};

/**
 * GET /admin/media/download-info - Download media metadata as JSON
 */
exports.downloadMediaInfo = async (req, res) => {
  try {
    // Get all media (non-deleted)
    const allMedia = await MediaBackup.find({ isDeleted: false })
      .select('fileName filePath module ownerType fileType size uploadedOn')
      .lean();

    // Add formatted info
    const exportData = allMedia.map(item => ({
      fileName: item.fileName,
      filePath: item.filePath,
      module: item.module,
      ownerType: item.ownerType,
      fileType: item.fileType,
      sizeBytes: item.size,
      sizeFormatted: formatBytes(item.size),
      uploadedOn: new Date(item.uploadedOn).toISOString()
    }));

    // Return as JSON file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="media-backup-info.json"');
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error('Error downloading media info:', error);
    req.flash('error', 'Failed to download media info');
    res.redirect('/admin/media');
  }
};
